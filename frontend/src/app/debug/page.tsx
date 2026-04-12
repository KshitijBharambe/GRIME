"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bug,
  Play,
  Pause,
  Square,
  RefreshCw,
  Download,
  EyeOff,
  Zap,
  Settings,
} from "lucide-react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";

interface DebugSession {
  id: string;
  session_name: string;
  execution_id: string;
  is_active: boolean;
  created_at: string;
  debug_data: {
    breakpoints: string[];
    variables: Record<string, number | string>;
  };
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: string;
}

export default function DebugToolsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { data: session } = useSession();
  const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([]);
  const [selectedSession, setSelectedSession] = useState<DebugSession | null>(
    null
  );
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);

  useEffect(() => {
    fetchDebugSessions();
    fetchTestScenarios();
  }, []);

  const fetchDebugSessions = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockSessions: DebugSession[] = [
        {
          id: "1",
          session_name: "Customer Data Validation Debug",
          execution_id: "exec_123",
          is_active: true,
          created_at: "2025-10-16T18:00:00Z",
          debug_data: {
            breakpoints: ["row_45", "row_89"],
            variables: {
              total_records: 1000,
              failed_records: 23,
            },
          },
        },
      ];
      setDebugSessions(mockSessions);
    } catch (error) {
      console.error("Failed to fetch debug sessions:", error);
    }
  };

  const fetchTestScenarios = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockScenarios: TestScenario[] = [
        {
          id: "1",
          name: "Null Value Detection",
          description: "Test scenarios for detecting null values in datasets",
          category: "Data Quality",
        },
        {
          id: "2",
          name: "Duplicate Detection",
          description: "Test scenarios for finding duplicate records",
          category: "Data Quality",
        },
        {
          id: "3",
          name: "Format Validation",
          description: "Test scenarios for validating data formats",
          category: "Validation",
        },
      ];
      setTestScenarios(mockScenarios);
    } catch (error) {
      console.error("Failed to fetch test scenarios:", error);
    }
  };

  const createDebugSession = async (executionId: string) => {
    try {
      // Mock API call - replace with actual implementation
      const newSession: DebugSession = {
        id: Date.now().toString(),
        session_name: `Debug Session ${Date.now()}`,
        execution_id: executionId,
        is_active: true,
        created_at: new Date().toISOString(),
        debug_data: {
          breakpoints: [],
          variables: {},
        },
      };
      setDebugSessions([newSession, ...debugSessions]);
      setSelectedSession(newSession);
    } catch (error) {
      console.error("Failed to create debug session:", error);
    }
  };

  const generateTestData = async (_scenarioId: string) => {
    setIsGeneratingTestData(true);
    try {
      // Mock API call - replace with actual implementation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // In real implementation, this would call the test data generation API
      console.log(`Generating test data for scenario: ${_scenarioId}`);
    } catch (error) {
      console.error("Failed to generate test data:", error);
    } finally {
      setIsGeneratingTestData(false);
    }
  };

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>
            Please log in to access debug tools.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="h-8 w-8" />
            Debug Tools
          </h1>
          <p className="text-muted-foreground mt-2">
            Advanced debugging and testing capabilities for data quality rules
          </p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions">Debug Sessions</TabsTrigger>
          <TabsTrigger value="test-data">Test Data Generation</TabsTrigger>
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Debug Sessions
                  </CardTitle>
                  <CardDescription>
                    Active and historical debug sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {debugSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSession?.id === session.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                session.is_active ? "default" : "secondary"
                              }
                            >
                              {session.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <span className="text-sm font-medium">
                              {session.session_name}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(session.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => createDebugSession("sample_execution")}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    New Debug Session
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedSession ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedSession.session_name}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm">
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </Button>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Execution: {selectedSession.execution_id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="breakpoints">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="breakpoints">
                          Breakpoints
                        </TabsTrigger>
                        <TabsTrigger value="variables">Variables</TabsTrigger>
                        <TabsTrigger value="logs">Execution Logs</TabsTrigger>
                      </TabsList>

                      <TabsContent value="breakpoints" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Active Breakpoints
                          </h4>
                          <Button variant="outline" size="sm">
                            Add Breakpoint
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {selectedSession.debug_data?.breakpoints?.map(
                            (bp: string) => (
                              <div
                                key={bp}
                                className="flex items-center justify-between p-2 bg-muted rounded"
                              >
                                <code className="text-sm">{bp}</code>
                                <Button variant="ghost" size="sm">
                                  <EyeOff className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          ) || (
                            <p className="text-sm text-muted-foreground">
                              No breakpoints set
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="variables" className="space-y-4">
                        <h4 className="text-sm font-medium">Debug Variables</h4>
                        <div className="space-y-2">
                          {Object.entries(
                            selectedSession.debug_data?.variables || {}
                          ).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between p-2 bg-muted rounded"
                            >
                              <span className="text-sm font-medium">{key}</span>
                              <code className="text-sm">{String(value)}</code>
                            </div>
                          )) || (
                            <p className="text-sm text-muted-foreground">
                              No variables tracked
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="logs" className="space-y-4">
                        <h4 className="text-sm font-medium">Execution Logs</h4>
                        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm space-y-1">
                          <div>
                            [2025-10-16 18:00:00] Starting debug session...
                          </div>
                          <div>[2025-10-16 18:00:01] Loading dataset...</div>
                          <div>
                            [2025-10-16 18:00:02] Processing 1000 records...
                          </div>
                          <div>
                            [2025-10-16 18:00:03] Found 23 validation issues
                          </div>
                          <div>[2025-10-16 18:00:04] Debug session active</div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">
                        No Debug Session Selected
                      </h3>
                      <p className="text-muted-foreground">
                        Select a debug session from the list or create a new one
                        to get started.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="test-data" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Scenarios</CardTitle>
                <CardDescription>
                  Predefined test scenarios for data quality validation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testScenarios.map((scenario) => (
                    <div key={scenario.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{scenario.name}</h4>
                        <Badge variant="outline">{scenario.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {scenario.description}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => generateTestData(scenario.id)}
                        disabled={isGeneratingTestData}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Data
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Test Data</CardTitle>
                <CardDescription>
                  Generate custom test data with specific parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="num-rows" className="text-sm font-medium">
                      Number of Rows
                    </label>
                    <input
                      id="num-rows"
                      type="number"
                      className="w-full mt-1 p-2 border rounded"
                      placeholder="1000"
                      defaultValue="1000"
                    />
                  </div>
                  <div>
                    <label htmlFor="columns-config" className="text-sm font-medium">
                      Columns Configuration
                    </label>
                    <textarea
                      id="columns-config"
                      className="w-full mt-1 p-2 border rounded"
                      rows={6}
                      placeholder="Configure columns and their properties..."
                    />
                  </div>
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generate Custom Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analysis</CardTitle>
              <CardDescription>
                Monitor and analyze the performance of data quality rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Performance Analysis Coming Soon
                </h3>
                <p className="text-muted-foreground">
                  Advanced performance monitoring and optimization tools will be
                  available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}
