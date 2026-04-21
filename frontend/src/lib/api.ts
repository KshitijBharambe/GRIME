import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  User,
  UserCreate,
  UserLogin,
  TokenResponse,
  UserRole,
  Dataset,
  DatasetCreate,
  DatasetVersion,
  DatasetColumn,
  Rule,
  RuleCreate,
  RuleUpdate,
  Execution,
  ExecutionCreate,
  Issue,
  PaginatedResponse,
  DataProfileResponse,
  RuleTestRequest,
  DashboardOverview,
  DataQualitySummary,
  ExecutionSummary,
  Export,
  ExportCreate,
  Fix,
  FixCreate,
  QualityMetrics,
  Organization,
  OrganizationCreate,
  OrganizationMember,
  OrganizationInvite,
  OrganizationUpdateData,
  SwitchOrganizationResponse,
  Compartment,
  CompartmentCreate,
  CompartmentUpdate,
  CompartmentMember,
  CompartmentMemberCreate,
  AccessRequest,
  AccessRequestCreate,
  AccessRequestApproval,
  PasswordChangeRequest,
  GuestLoginResponse,
  PersonalRegisterRequest,
  PersonalRegisterResponse,
  DataSource,
  DataSourceCreate,
  DataSourceUpdate,
  DataSourceTestResult,
  DataCatalogEntry,
  CatalogImportRequest,
  CatalogImportResult,
} from "@/types/api";
import { getApiUrl } from "./config";

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private readonly maxRetries = 2;
  private authFailureHandled = false;

  constructor(baseURL: string = getApiUrl()) {
    // Ensure HTTPS in production
    const isLocalHttp =
      baseURL.startsWith("http://localhost") ||
      baseURL.startsWith("http://127.0.0.1");
    const secureURL =
      process.env.NODE_ENV === "production" &&
      baseURL.startsWith("http://") &&
      !isLocalHttp
        ? baseURL.replace("http://", "https://")
        : baseURL;

    this.client = axios.create({
      baseURL: secureURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as
          | (typeof error.config & { __retryCount?: number })
          | undefined;

        if (config) {
          const status = error.response?.status;
          const isNetworkError = !error.response;
          const isRetriableStatus = typeof status === "number" && status >= 500;

          config.__retryCount = config.__retryCount || 0;

          if (
            (isNetworkError || isRetriableStatus) &&
            config.__retryCount < this.maxRetries
          ) {
            config.__retryCount += 1;
            return this.client.request(config);
          }
        }

        this.handleAuthenticationFailure(error);
        return Promise.reject(error);
      },
    );
  }

  private handleAuthenticationFailure(error: unknown) {
    if (typeof window === "undefined") {
      return;
    }

    const axiosError = error as {
      response?: {
        status?: number;
        data?: { detail?: unknown; message?: unknown; code?: unknown };
      };
    };

    const status = axiosError.response?.status;
    const detail = String(
      axiosError.response?.data?.detail ?? "",
    ).toLowerCase();
    const message = String(
      axiosError.response?.data?.message ?? "",
    ).toLowerCase();
    const code = String(axiosError.response?.data?.code ?? "").toLowerCase();

    const indicatesGuestExpired =
      (detail.includes("guest") && detail.includes("expire")) ||
      (message.includes("guest") && message.includes("expire")) ||
      code.includes("guest_expired") ||
      code.includes("guest-expired");

    const isUnauthorized = status === 401;

    if (!isUnauthorized && !indicatesGuestExpired) {
      return;
    }

    this.clearToken();

    if (this.authFailureHandled) {
      return;
    }

    this.authFailureHandled = true;
    window.dispatchEvent(
      new CustomEvent("app:force-signout", {
        detail: {
          reason: indicatesGuestExpired ? "guest-expired" : "unauthorized",
          status,
        },
      }),
    );

    window.setTimeout(() => {
      this.authFailureHandled = false;
    }, 1500);
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  getToken() {
    return this.token;
  }

  // Auth endpoints
  async login(credentials: UserLogin): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>(
      "/auth/login",
      credentials,
    );
    this.setToken(response.data.access_token);
    return response.data;
  }

  async register(userData: UserCreate): Promise<User> {
    const response = await this.client.post<User>("/auth/register", userData);
    return response.data;
  }

  async registerOrganization(
    orgData: OrganizationCreate,
  ): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>(
      "/auth/register-organization",
      orgData,
    );
    return response.data;
  }

  async guestLogin(): Promise<GuestLoginResponse> {
    const response =
      await this.client.post<GuestLoginResponse>("/auth/guest-login");
    this.setToken(response.data.access_token);
    return response.data;
  }

  async registerPersonal(
    data: PersonalRegisterRequest,
  ): Promise<PersonalRegisterResponse> {
    const response = await this.client.post<PersonalRegisterResponse>(
      "/auth/register-personal",
      data,
    );
    this.setToken(response.data.access_token);
    return response.data;
  }

  async loginWithOrg(credentials: {
    email: string;
    password: string;
    organization_id: string;
  }): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>(
      "/auth/login",
      credentials,
    );
    this.setToken(response.data.access_token);
    return response.data;
  }

  async getUserOrganizations(): Promise<Organization[]> {
    if (globalThis.window !== undefined) {
      const response = await fetch("/api/auth/organizations", {
        method: "GET",
        headers: this.token
          ? {
              Authorization: `Bearer ${this.token}`,
            }
          : {},
      });

      if (!response.ok) {
        let detail = "Failed to fetch organizations";
        try {
          const data = (await response.json()) as { detail?: string };
          if (data?.detail) {
            detail = data.detail;
          }
        } catch {
          // Keep generic message if response body is not JSON.
        }

        throw new Error(detail);
      }

      return (await response.json()) as Organization[];
    }

    const response = await this.client.get<Organization[]>(
      "/auth/organizations",
    );
    return response.data;
  }

  async switchOrganization(
    organizationId: string,
  ): Promise<SwitchOrganizationResponse> {
    const response = await this.client.post<SwitchOrganizationResponse>(
      "/auth/switch-organization",
      {
        organization_id: organizationId,
      },
    );
    this.setToken(response.data.access_token);
    return response.data;
  }

  async getOrganizationDetails(): Promise<Organization> {
    const response = await this.client.get<Organization>(
      "/auth/organization/details",
    );
    return response.data;
  }

  async updateOrganizationDetails(
    data: OrganizationUpdateData,
  ): Promise<Organization> {
    const response = await this.client.put<Organization>(
      "/auth/organization/details",
      data,
    );
    return response.data;
  }

  // Team management endpoints
  async getOrganizationMembers(): Promise<OrganizationMember[]> {
    const response =
      await this.client.get<OrganizationMember[]>("/auth/members");
    return response.data;
  }

  async inviteMember(
    email: string,
    role: UserRole,
  ): Promise<OrganizationInvite> {
    const response = await this.client.post<OrganizationInvite>(
      "/auth/invite-user",
      {
        email,
        role,
      },
    );
    return response.data;
  }

  async getInvitations(): Promise<OrganizationInvite[]> {
    const response =
      await this.client.get<OrganizationInvite[]>("/auth/invites");
    return response.data;
  }

  async revokeInvitation(inviteId: string): Promise<void> {
    await this.client.delete(`/auth/invites/${inviteId}`);
  }

  async updateMemberRole(
    memberId: string,
    role: UserRole,
  ): Promise<OrganizationMember> {
    const response = await this.client.put<OrganizationMember>(
      `/auth/members/${memberId}/role`,
      {
        role,
      },
    );
    return response.data;
  }

  async removeMember(memberId: string): Promise<void> {
    await this.client.delete(`/auth/members/${memberId}`);
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>("/auth/me");
    return response.data;
  }

  // Dataset endpoints
  async getDatasets(): Promise<PaginatedResponse<Dataset>> {
    const response = await this.client.get<Dataset[]>("/data/datasets");
    // Convert the array response to paginated format for consistency
    const datasets = Array.isArray(response.data) ? response.data : [];
    return {
      items: datasets,
      total: datasets.length,
      page: 1,
      size: datasets.length,
      pages: 1,
    };
  }

  async getDataset(id: string): Promise<Dataset> {
    const response = await this.client.get<Dataset>(`/data/datasets/${id}`);
    return response.data;
  }

  async createDataset(dataset: DatasetCreate): Promise<Dataset> {
    const response = await this.client.post<Dataset>("/data/datasets", dataset);
    return response.data;
  }

  async updateDataset(
    id: string,
    dataset: Partial<DatasetCreate>,
  ): Promise<Dataset> {
    const response = await this.client.put<Dataset>(
      `/data/datasets/${id}`,
      dataset,
    );
    return response.data;
  }

  async deleteDataset(id: string): Promise<void> {
    await this.client.delete(`/data/datasets/${id}`);
  }

  async uploadFile(
    file: File,
    datasetName: string,
    description?: string,
  ): Promise<{
    message: string;
    filename: string;
    size: number;
    dataset_id: string;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("dataset_name", datasetName);
    if (description) {
      formData.append("description", description);
    }

    const response = await this.client.post<{
      message: string;
      filename: string;
      size: number;
      dataset_id: string;
    }>("/data/upload/file", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  async getDataProfile(datasetId: string): Promise<DataProfileResponse> {
    const response = await this.client.get<DataProfileResponse>(
      `/data/datasets/${datasetId}/profile`,
    );
    return response.data;
  }

  // Dataset versions
  async getDatasetVersions(datasetId: string): Promise<DatasetVersion[]> {
    try {
      const response = await this.client.get<DatasetVersion[]>(
        `/datasets/${datasetId}/versions`,
      );
      return response.data;
    } catch (error) {
      // Some deployments don't expose a public dataset versions listing endpoint.
      // Returning an empty list lets callers render a graceful fallback state.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async getDatasetVersion(
    datasetId: string,
    versionId: string,
  ): Promise<DatasetVersion> {
    const response = await this.client.get<DatasetVersion>(
      `/datasets/${datasetId}/versions/${versionId}`,
    );
    return response.data;
  }

  // Dataset columns
  async getDatasetColumns(datasetId: string): Promise<DatasetColumn[]> {
    const response = await this.client.get<DatasetColumn[]>(
      `/data/datasets/${datasetId}/columns`,
    );
    return response.data;
  }

  // Rule endpoints
  async getRules(): Promise<PaginatedResponse<Rule>> {
    const response = await this.client.get<Rule[]>("/rules", {
      params: {
        active_only: false, // Get all rules, not just active ones
      },
    });
    // Convert the array response to paginated format for consistency
    const rules = Array.isArray(response.data) ? response.data : [];
    return {
      items: rules,
      total: rules.length,
      page: 1,
      size: rules.length,
      pages: 1,
    };
  }

  async getRule(id: string): Promise<Rule> {
    const response = await this.client.get<Rule>(`/rules/${id}`);
    return response.data;
  }

  async createRule(rule: RuleCreate): Promise<Rule> {
    const response = await this.client.post<Rule>("/rules", rule);
    return response.data;
  }

  async updateRule(id: string, rule: RuleUpdate): Promise<Rule> {
    const response = await this.client.put<Rule>(`/rules/${id}`, rule);
    return response.data;
  }

  async deleteRule(id: string): Promise<void> {
    await this.client.delete(`/rules/${id}`);
  }

  async testRule(
    ruleId: string,
    testData: RuleTestRequest,
  ): Promise<{ success: boolean; message: string; results?: unknown }> {
    const response = await this.client.post(`/rules/${ruleId}/test`, testData);
    return response.data;
  }

  async getRuleKinds(): Promise<
    { kind: string; description: string; parameters: unknown }[]
  > {
    const response = await this.client.get("/rules/kinds/available");
    return response.data;
  }

  async activateRule(id: string): Promise<void> {
    await this.client.patch(`/rules/${id}/activate`);
  }

  async deactivateRule(id: string): Promise<void> {
    await this.client.patch(`/rules/${id}/deactivate`);
  }

  async getRuleVersions(id: string): Promise<Rule[]> {
    const response = await this.client.get<Rule[]>(`/rules/${id}/versions`);
    return response.data;
  }

  // Execution endpoints
  async getExecutions(
    page: number = 1,
    size: number = 20,
  ): Promise<PaginatedResponse<Execution>> {
    const response = await this.client.get<PaginatedResponse<Execution>>(
      "/executions",
      {
        params: { page, size },
      },
    );
    return response.data;
  }

  async getExecution(id: string): Promise<Execution> {
    const response = await this.client.get<Execution>(`/executions/${id}`);
    return response.data;
  }

  async createExecution(execution: ExecutionCreate): Promise<Execution> {
    const response = await this.client.post<Execution>(
      "/executions",
      execution,
    );
    return response.data;
  }

  async getExecutionSummary(id: string): Promise<ExecutionSummary> {
    const response = await this.client.get<ExecutionSummary>(
      `/executions/${id}/summary`,
    );
    return response.data;
  }

  async getExecutionQualityMetrics(
    executionId: string,
  ): Promise<QualityMetrics> {
    const response = await this.client.get<QualityMetrics>(
      `/executions/${executionId}/quality-metrics`,
    );
    return response.data;
  }

  // Issue endpoints
  async getIssues(
    executionId?: string,
    page: number = 1,
    size: number = 1000,
  ): Promise<PaginatedResponse<Issue>> {
    const params: Record<string, unknown> = {
      limit: size,
      offset: (page - 1) * size,
    };
    if (executionId) params.execution_id = executionId;

    const response = await this.client.get<Issue[]>("/issues", { params });

    // Convert array response to paginated format
    const issues = Array.isArray(response.data) ? response.data : [];
    return {
      items: issues,
      total: issues.length,
      page: page,
      size: size,
      pages: 1,
    };
  }

  async getIssue(id: string): Promise<Issue> {
    const response = await this.client.get<Issue>(`/issues/${id}`);
    return response.data;
  }

  async resolveIssue(id: string): Promise<Issue> {
    const response = await this.client.post<Issue>(`/issues/${id}/resolve`);
    return response.data;
  }

  // Fix endpoints
  async createFix(fix: FixCreate): Promise<Fix> {
    const response = await this.client.post<Fix>("/fixes", fix);
    return response.data;
  }

  async getFixes(issueId: string): Promise<Fix[]> {
    const response = await this.client.get<Fix[]>(`/issues/${issueId}/fixes`);
    return response.data;
  }

  // Export endpoints
  async getExports(
    page: number = 1,
    size: number = 20,
  ): Promise<PaginatedResponse<Export>> {
    const response = await this.client.get<PaginatedResponse<Export>>(
      "/exports",
      {
        params: { page, size },
      },
    );
    return response.data;
  }

  async createExport(exportData: ExportCreate): Promise<Export> {
    const response = await this.client.post<Export>("/exports", exportData);
    return response.data;
  }

  async downloadExport(id: string): Promise<Blob> {
    const response = await this.client.get(`/exports/${id}/download`, {
      responseType: "blob",
    });
    return response.data;
  }

  // Report endpoints
  async getDataQualitySummary(): Promise<DataQualitySummary> {
    const response = await this.client.get<DataQualitySummary>(
      "/reports/data-quality-summary",
    );
    return response.data;
  }

  async getExecutionReports(
    page: number = 1,
    size: number = 20,
  ): Promise<PaginatedResponse<ExecutionSummary>> {
    const response = await this.client.get<PaginatedResponse<ExecutionSummary>>(
      "/reports/executions",
      {
        params: { page, size },
      },
    );
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardOverview(): Promise<DashboardOverview> {
    const response = await this.client.get<DashboardOverview>(
      "/reports/dashboard/overview",
    );
    return response.data;
  }

  // Quality Reports endpoints
  async getQualitySummary(datasetId: string): Promise<unknown> {
    const response = await this.client.get(
      `/reports/datasets/${datasetId}/quality-summary`,
    );
    return response.data;
  }

  async generateQualityReport(
    datasetId: string,
    includeCharts: boolean = false,
  ): Promise<{
    export_id: string;
    dataset_id: string;
    dataset_name: string;
    report_type: string;
    file_path: string;
    download_url: string;
    include_charts: boolean;
  }> {
    const response = await this.client.post(
      `/reports/datasets/${datasetId}/quality-report`,
      null,
      {
        params: { include_charts: includeCharts },
      },
    );
    return response.data;
  }

  async getQualityTrends(days: number = 30): Promise<unknown> {
    const response = await this.client.get(
      "/reports/analytics/quality-trends",
      {
        params: { days },
      },
    );
    return response.data;
  }

  async getIssuePatterns(): Promise<unknown> {
    const response = await this.client.get("/reports/analytics/issue-patterns");
    return response.data;
  }

  async getAllDatasetsQualityScores(): Promise<{
    datasets: Array<{
      id: string;
      name: string;
      quality_score: number;
      total_rows: number;
      total_issues: number;
      total_fixes: number;
      status: string;
    }>;
    total_datasets: number;
  }> {
    const response = await this.client.get("/reports/datasets/quality-scores");
    return response.data;
  }

  // Export Data endpoints
  async exportDataset(
    datasetId: string,
    format: string,
    includeMetadata: boolean = true,
    includeIssues: boolean = false,
    executionId?: string,
  ): Promise<{
    export_id: string;
    dataset_id: string;
    dataset_name: string;
    version_number: number;
    export_format: string;
    file_path: string;
    include_metadata: boolean;
    include_issues: boolean;
    download_url: string;
  }> {
    const response = await this.client.post(
      `/reports/datasets/${datasetId}/export`,
      null,
      {
        params: {
          export_format: format,
          include_metadata: includeMetadata,
          include_issues: includeIssues,
          execution_id: executionId,
        },
      },
    );
    return response.data;
  }

  async getExportHistory(datasetId: string): Promise<{
    dataset_id: string;
    dataset_name: string;
    total_exports: number;
    exports: unknown[];
  }> {
    const response = await this.client.get(
      `/reports/datasets/${datasetId}/export-history`,
    );
    return response.data;
  }

  async downloadExportFile(exportId: string): Promise<Blob> {
    const response = await this.client.get(
      `/reports/exports/${exportId}/download`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  }

  async deleteExport(exportId: string): Promise<void> {
    await this.client.delete(`/reports/exports/${exportId}`);
  }

  // User management endpoints (admin only)
  async getUsers(): Promise<User[]> {
    const response = await this.client.get<User[]>("/auth/users");
    return response.data;
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
  ): Promise<{ message: string; user: User }> {
    const response = await this.client.put<{ message: string; user: User }>(
      `/auth/users/${userId}/role`,
      { role },
    );
    return response.data;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.delete(`/auth/users/${userId}`);
  }

  async createUser(userData: UserCreate): Promise<User> {
    const response = await this.client.post<User>("/auth/register", userData);
    return response.data;
  }

  // Compartment endpoints
  async getCompartments(): Promise<Compartment[]> {
    const response = await this.client.get<Compartment[]>("/compartments");
    return response.data;
  }

  async getCompartment(id: string): Promise<Compartment> {
    const response = await this.client.get<Compartment>(`/compartments/${id}`);
    return response.data;
  }

  async createCompartment(data: CompartmentCreate): Promise<Compartment> {
    const response = await this.client.post<Compartment>("/compartments", data);
    return response.data;
  }

  async updateCompartment(
    id: string,
    data: CompartmentUpdate,
  ): Promise<Compartment> {
    const response = await this.client.put<Compartment>(
      `/compartments/${id}`,
      data,
    );
    return response.data;
  }

  async deleteCompartment(id: string): Promise<void> {
    await this.client.delete(`/compartments/${id}`);
  }

  async getCompartmentMembers(
    compartmentId: string,
  ): Promise<CompartmentMember[]> {
    const response = await this.client.get<CompartmentMember[]>(
      `/compartments/${compartmentId}/members`,
    );
    return response.data;
  }

  async addCompartmentMember(
    compartmentId: string,
    data: CompartmentMemberCreate,
  ): Promise<CompartmentMember> {
    const response = await this.client.post<CompartmentMember>(
      `/compartments/${compartmentId}/members`,
      data,
    );
    return response.data;
  }

  async removeCompartmentMember(
    compartmentId: string,
    memberId: string,
  ): Promise<void> {
    await this.client.delete(
      `/compartments/${compartmentId}/members/${memberId}`,
    );
  }

  // Access Request endpoints
  async getMyAccessRequests(): Promise<AccessRequest[]> {
    const response = await this.client.get<AccessRequest[]>("/access-requests");
    return response.data;
  }

  async getPendingApprovals(): Promise<AccessRequest[]> {
    const response = await this.client.get<AccessRequest[]>(
      "/access-requests/pending",
    );
    return response.data;
  }

  async createAccessRequest(data: AccessRequestCreate): Promise<AccessRequest> {
    const response = await this.client.post<AccessRequest>(
      "/access-requests",
      data,
    );
    return response.data;
  }

  async requestPasswordChange(
    data: PasswordChangeRequest,
  ): Promise<AccessRequest> {
    const response = await this.client.post<AccessRequest>(
      "/access-requests/password-change",
      data,
    );
    return response.data;
  }

  async approveAccessRequest(
    id: string,
    data: AccessRequestApproval,
  ): Promise<AccessRequest> {
    const response = await this.client.put<AccessRequest>(
      `/access-requests/${id}/approve`,
      data,
    );
    return response.data;
  }

  async rejectAccessRequest(
    id: string,
    data: AccessRequestApproval,
  ): Promise<AccessRequest> {
    const response = await this.client.put<AccessRequest>(
      `/access-requests/${id}/reject`,
      data,
    );
    return response.data;
  }

  async cancelAccessRequest(id: string): Promise<void> {
    await this.client.delete(`/access-requests/${id}`);
  }

  // Generic HTTP methods for direct API access
  async get<T = unknown>(
    url: string,
    config?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = unknown>(
    url: string,
    config?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // Data Sources
  async getDataSources(): Promise<DataSource[]> {
    const r = await this.client.get<DataSource[]>("/api/data-sources");
    return r.data;
  }

  async getDataSource(id: string): Promise<DataSource> {
    const r = await this.client.get<DataSource>(`/api/data-sources/${id}`);
    return r.data;
  }

  async createDataSource(payload: DataSourceCreate): Promise<DataSource> {
    const r = await this.client.post<DataSource>("/api/data-sources", payload);
    return r.data;
  }

  async updateDataSource(id: string, payload: DataSourceUpdate): Promise<DataSource> {
    const r = await this.client.patch<DataSource>(`/api/data-sources/${id}`, payload);
    return r.data;
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.client.delete(`/api/data-sources/${id}`);
  }

  async testDataSourceConnection(id: string): Promise<DataSourceTestResult> {
    const r = await this.client.post<DataSourceTestResult>(`/api/data-sources/${id}/test`);
    return r.data;
  }

  async syncDataSourceCatalog(id: string): Promise<DataCatalogEntry[]> {
    const r = await this.client.post<DataCatalogEntry[]>(`/api/data-sources/${id}/sync`);
    return r.data;
  }

  async getDataSourceCatalog(id: string): Promise<DataCatalogEntry[]> {
    const r = await this.client.get<DataCatalogEntry[]>(`/api/data-sources/${id}/catalog`);
    return r.data;
  }

  async importCatalogEntry(sourceId: string, payload: CatalogImportRequest): Promise<CatalogImportResult> {
    const r = await this.client.post<CatalogImportResult>(`/api/data-sources/${sourceId}/catalog/import`, payload);
    return r.data;
  }

  async getAllCatalogEntries(): Promise<DataCatalogEntry[]> {
    const r = await this.client.get<DataCatalogEntry[]>("/api/data-sources/catalog/all");
    return r.data;
  }
}

// Singleton instance - recreate on client-side to ensure correct URL
let instance: ApiClient | null = null;
let lastUrl: string | null = null;

function getInstance(): ApiClient {
  const currentUrl = getApiUrl();

  // Recreate instance if URL changed or doesn't exist
  if (!instance || lastUrl !== currentUrl) {
    instance = new ApiClient(currentUrl);
    lastUrl = currentUrl;
  }

  return instance;
}

// Export proxy for lazy initialization
const apiClient = new Proxy({} as ApiClient, {
  get(_target, prop: string) {
    const inst = getInstance();
    const value = inst[prop as keyof ApiClient];
    return typeof value === "function" ? value.bind(inst) : value;
  },
});

export default apiClient;
export { ApiClient };
