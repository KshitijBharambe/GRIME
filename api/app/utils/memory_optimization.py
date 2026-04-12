"""
Memory optimization utilities for the Data Hygiene Toolkit.
Provides chunking, streaming, and memory monitoring capabilities.
"""

import pandas as pd
import psutil
import os
import logging
from typing import Iterator, Optional, Dict
from io import BytesIO

logger = logging.getLogger(__name__)


class MemoryMonitor:
    """Monitor and log memory usage"""
    
    @staticmethod
    def get_memory_usage() -> Dict[str, float]:
        """Get current process memory usage in MB"""
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
            'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
            'percent': process.memory_percent()
        }
    
    @staticmethod
    def log_memory_usage(context: str = ""):
        """Log current memory usage"""
        usage = MemoryMonitor.get_memory_usage()
        logger.info(
            f"Memory usage {context}: "
            f"RSS={usage['rss_mb']:.2f}MB, "
            f"VMS={usage['vms_mb']:.2f}MB, "
            f"Percent={usage['percent']:.2f}%"
        )
    
    @staticmethod
    def check_memory_limit(threshold_percent: float = 80.0):
        """
        Check if memory usage exceeds threshold.
        Raises warning if threshold exceeded.
        """
        usage = MemoryMonitor.get_memory_usage()
        if usage['percent'] > threshold_percent:
            logger.warning(
                f"Memory usage high: {usage['percent']:.2f}% "
                f"(threshold: {threshold_percent}%)"
            )
            return True
        return False


class ChunkedDataFrameReader:
    """Read and process large DataFrames in chunks"""
    
    def __init__(
        self,
        chunk_size: int = 10000,
        memory_threshold_mb: int = 150
    ):
        """
        Initialize chunked reader.
        
        Args:
            chunk_size: Number of rows per chunk
            memory_threshold_mb: Memory threshold to trigger chunking (MB)
        """
        self.chunk_size = chunk_size
        self.memory_threshold_mb = memory_threshold_mb
    
    def should_use_chunking(self, df: Optional[pd.DataFrame] = None, file_size_mb: Optional[float] = None) -> bool:
        """
        Determine if chunking should be used based on DataFrame size or file size.
        
        Args:
            df: DataFrame to check (if already loaded)
            file_size_mb: File size in MB (if not yet loaded)
        
        Returns:
            True if chunking should be used
        """
        # Check current memory usage
        current_memory = MemoryMonitor.get_memory_usage()['rss_mb']
        
        if df is not None:
            # Estimate DataFrame memory usage
            df_memory_mb = df.memory_usage(deep=True).sum() / 1024 / 1024
            
            # Use chunking if:
            # 1. DataFrame is large (>50MB)
            # 2. Current memory + DF would exceed threshold
            return (
                df_memory_mb > 50 or
                (current_memory + df_memory_mb) > self.memory_threshold_mb
            )
        
        if file_size_mb is not None:
            # Rough estimate: CSV/Excel typically expand 2-3x in memory
            estimated_memory_mb = file_size_mb * 2.5
            return estimated_memory_mb > 50
        
        return False
    
    def read_csv_chunked(
        self,
        file_content: bytes,
        encoding: str = 'utf-8',
        **kwargs
    ) -> Iterator[pd.DataFrame]:
        """
        Read CSV in chunks from bytes content.
        
        Args:
            file_content: CSV file content as bytes
            encoding: File encoding
            **kwargs: Additional arguments for pd.read_csv
        
        Yields:
            DataFrame chunks
        """
        logger.info(f"Reading CSV in chunks (chunk_size={self.chunk_size})")
        MemoryMonitor.log_memory_usage("before chunked read")
        
        chunks = pd.read_csv(
            BytesIO(file_content),
            encoding=encoding,
            chunksize=self.chunk_size,
            **kwargs
        )
        
        for i, chunk in enumerate(chunks):
            logger.debug(f"Processing chunk {i+1} ({len(chunk)} rows)")
            MemoryMonitor.log_memory_usage(f"chunk {i+1}")
            yield chunk
    
    def read_excel_chunked(
        self,
        file_content: bytes,
        **kwargs
    ) -> Iterator[pd.DataFrame]:
        """
        Read Excel in chunks from bytes content.
        Note: Excel doesn't support native chunking, so we read full then yield chunks.
        
        Args:
            file_content: Excel file content as bytes
            **kwargs: Additional arguments for pd.read_excel
        
        Yields:
            DataFrame chunks
        """
        logger.info(f"Reading Excel file and chunking (chunk_size={self.chunk_size})")
        MemoryMonitor.log_memory_usage("before Excel read")
        
        # Excel requires full read first
        df = pd.read_excel(BytesIO(file_content), **kwargs)
        
        MemoryMonitor.log_memory_usage("after Excel read")
        
        # Yield in chunks
        for i in range(0, len(df), self.chunk_size):
            chunk = df.iloc[i:i + self.chunk_size]
            logger.debug(f"Processing chunk {i//self.chunk_size + 1} ({len(chunk)} rows)")
            yield chunk
    
    def process_in_chunks(
        self,
        df: pd.DataFrame,
        processor_func,
        combine_results: bool = True
    ):
        """
        Process a DataFrame in chunks using a custom function.
        
        Args:
            df: DataFrame to process
            processor_func: Function that takes a DataFrame chunk and returns results
            combine_results: If True, combine results into a single list
        
        Returns:
            Combined results or generator of results
        """
        logger.info(f"Processing DataFrame in chunks (chunk_size={self.chunk_size})")
        MemoryMonitor.log_memory_usage("before processing")
        
        results = []
        
        for i in range(0, len(df), self.chunk_size):
            chunk = df.iloc[i:i + self.chunk_size]
            logger.debug(f"Processing chunk {i//self.chunk_size + 1}")
            
            chunk_result = processor_func(chunk)
            
            if combine_results:
                if isinstance(chunk_result, list):
                    results.extend(chunk_result)
                else:
                    results.append(chunk_result)
            else:
                yield chunk_result
            
            # Check memory after each chunk
            MemoryMonitor.check_memory_limit()
        
        MemoryMonitor.log_memory_usage("after processing")
        
        if combine_results:
            return results


class OptimizedDataFrameOperations:
    """Optimized pandas operations for memory efficiency"""
    
    @staticmethod
    def optimize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
        """
        Optimize DataFrame dtypes to reduce memory usage.
        Downcasts numeric types and converts objects where possible.
        """
        logger.info("Optimizing DataFrame dtypes")
        initial_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
        
        # Optimize numeric columns
        for col in df.select_dtypes(include=['int']).columns:
            df[col] = pd.to_numeric(df[col], downcast='integer')
        
        for col in df.select_dtypes(include=['float']).columns:
            df[col] = pd.to_numeric(df[col], downcast='float')
        
        # Convert object columns to category if cardinality is low
        for col in df.select_dtypes(include=['object']).columns:
            num_unique = df[col].nunique()
            num_total = len(df[col])
            
            # If less than 50% unique values, use category
            if num_unique / num_total < 0.5:
                df[col] = df[col].astype('category')
        
        final_memory = df.memory_usage(deep=True).sum() / 1024 / 1024
        saved_memory = initial_memory - final_memory
        
        logger.info(
            "Memory optimization: "
            f"{initial_memory:.2f}MB -> {final_memory:.2f}MB "
            f"(saved {saved_memory:.2f}MB, {saved_memory/initial_memory*100:.1f}%)"
        )
        
        return df
    
    @staticmethod
    def sample_large_dataframe(
        df: pd.DataFrame,
        max_rows: int = 100000,
        strategy: str = 'head'
    ) -> pd.DataFrame:
        """
        Sample a large DataFrame for analysis.
        
        Args:
            df: DataFrame to sample
            max_rows: Maximum rows to keep
            strategy: 'head', 'tail', 'random', or 'stratified'
        
        Returns:
            Sampled DataFrame
        """
        if len(df) <= max_rows:
            return df
        
        logger.warning(
            f"DataFrame has {len(df)} rows, sampling to {max_rows} rows "
            f"using {strategy!r} strategy"
        )
        
        if strategy == 'head':
            return df.head(max_rows)
        elif strategy == 'tail':
            return df.tail(max_rows)
        elif strategy == 'random':
            return df.sample(n=max_rows, random_state=42)
        elif strategy == 'stratified':
            # Sample proportionally from each group (if applicable)
            # This is a simple version; could be enhanced
            return df.sample(n=max_rows, random_state=42)
        else:
            return df.head(max_rows)


# Convenience functions
def estimate_file_memory(file_size_bytes: int, file_type: str = 'csv') -> float:
    """
    Estimate memory usage when loading a file.
    
    Args:
        file_size_bytes: File size in bytes
        file_type: 'csv', 'excel', or 'parquet'
    
    Returns:
        Estimated memory usage in MB
    """
    multipliers = {
        'csv': 2.5,      # CSV typically expands ~2.5x in memory
        'excel': 3.0,    # Excel can be larger due to formatting
        'parquet': 1.2,  # Parquet is compressed
    }
    
    multiplier = multipliers.get(file_type.lower(), 2.5)
    file_size_mb = file_size_bytes / 1024 / 1024
    estimated_mb = file_size_mb * multiplier
    
    logger.debug(
        f"File size: {file_size_mb:.2f}MB ({file_type}), "
        f"estimated memory: {estimated_mb:.2f}MB"
    )
    
    return estimated_mb
