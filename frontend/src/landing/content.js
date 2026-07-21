import { Search, Brain, Eye, Shield, Users, FileText } from "lucide-react";

export const METHOD_STYLES = {
  GET: {
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    dot: "bg-blue-400",
    glow: "shadow-blue-500/50",
  },
  POST: {
    badge: "bg-green-500/20 text-green-300 border-green-500/40",
    dot: "bg-green-400",
    glow: "shadow-green-500/50",
  },
  DELETE: {
    badge: "bg-red-500/20 text-red-300 border-red-500/40",
    dot: "bg-red-400",
    glow: "shadow-red-500/50",
  },
  PATCH: {
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    dot: "bg-yellow-400",
    glow: "shadow-yellow-500/50",
  },
  PUT: {
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    dot: "bg-purple-400",
    glow: "shadow-purple-500/50",
  },
};

export const REQUEST_POOL = [
  {
    method: "POST",
    path: "/api/users/create",
    status: 201,
    ms: 142,
    passed: true,
    label: "User Creation",
  },
  {
    method: "GET",
    path: "/api/products",
    status: 200,
    ms: 89,
    passed: true,
    label: "Product List",
  },
  {
    method: "DELETE",
    path: "/api/orders/42",
    status: 404,
    ms: 210,
    passed: false,
    label: "Order Delete",
  },
  {
    method: "PATCH",
    path: "/api/profile",
    status: 200,
    ms: 95,
    passed: true,
    label: "Profile Update",
  },
  {
    method: "PUT",
    path: "/api/settings",
    status: 200,
    ms: 77,
    passed: true,
    label: "Config Set",
  },
  {
    method: "GET",
    path: "/api/auth/verify",
    status: 401,
    ms: 55,
    passed: false,
    label: "Auth Verify",
  },
  {
    method: "POST",
    path: "/api/payments",
    status: 201,
    ms: 320,
    passed: true,
    label: "Payment Init",
  },
  {
    method: "GET",
    path: "/api/health",
    status: 200,
    ms: 12,
    passed: true,
    label: "Health Check",
  },
  {
    method: "DELETE",
    path: "/api/cache/flush",
    status: 200,
    ms: 43,
    passed: true,
    label: "Cache Flush",
  },
  {
    method: "PUT",
    path: "/api/roles/admin",
    status: 403,
    ms: 30,
    passed: false,
    label: "Role Update",
  },
];

export const MATRIX_GROUPS = [
  {
    tab: "Testing",
    label: "01 · Testing Capabilities",
    rows: [
      { label: "Auto-Discovery", vals: ["check", "dash", "dash", "dash"] },
      {
        label: "Functional Testing",
        vals: ["check", "check", "check", "check"],
      },
      {
        label: "Performance Testing",
        vals: ["check", "addon", "check", "dash"],
      },
      { label: "Chaos & Fuzz", vals: ["check", "dash", "partial", "dash"] },
      {
        label: "Regression Testing",
        vals: ["check", "partial", "check", "dash"],
      },
      {
        label: "Contract Testing",
        vals: ["check", "partial", "partial", "partial"],
      },
      {
        label: "GraphQL Testing",
        vals: ["check", "check", "partial", "check"],
      },
      { label: "Flow Builder", vals: ["check", "partial", "dash", "dash"] },
    ],
  },
  {
    tab: "AI",
    label: "02 · AI Features",
    rows: [
      {
        label: "AI Test Generation",
        vals: ["check", "partial", "partial", "dash"],
      },
      {
        label: "Natural Language Tests",
        vals: ["check", "dash", "dash", "dash"],
      },
      {
        label: "Root Cause Analysis",
        vals: ["check", "dash", "partial", "dash"],
      },
      { label: "Vibe Testing", vals: ["check", "dash", "dash", "dash"] },
    ],
  },
  {
    tab: "DX",
    label: "03 · Developer Experience",
    rows: [
      {
        label: "Live Streaming (SSE)",
        vals: ["check", "dash", "dash", "dash"],
      },
      { label: "PDF Reports", vals: ["check", "paid", "check", "dash"] },
      {
        label: "GitHub Integration",
        vals: ["check", "check", "check", "check"],
      },
      { label: "Team Collaboration", vals: ["check", "paid", "paid", "paid"] },
      { label: "Free to Use", vals: ["check", "partial", "dash", "check"] },
    ],
  },
];

export const REVIEW_CARDS = [
  {
    kind: "pro",
    name: "Karthik",
    role: "Tester",
    init: "K",
    grad: "from-blue-600 to-cyan-500",
    stars: 5,
    text: "A nice platform with 20+ AI features — makes manual work much easier in API testing.",
  },
  {
    kind: "pro",
    name: "Aman",
    role: "Automation Architect",
    init: "A",
    grad: "from-cyan-600 to-blue-500",
    stars: 5,
    text: "8 testing types and 25+ AI features. Tested on 10 APIs with ~90% accuracy. Impressive!",
  },
  {
    kind: "pro",
    name: "Adarsh",
    role: "Solution Architect",
    init: "AD",
    grad: "from-indigo-600 to-blue-500",
    stars: 5,
    text: "Unified with all testing types — exactly what the industry was missing.",
  },
  {
    kind: "student",
    title: "Exploring New Testing Types",
    accent: "#10b981",
    border: "rgba(16,185,129,0.22)",
    text: "Amazing to see Fuzz, Chaos, and Contract testing all in one place. The platform makes it easy to understand and implement them. Great learning resource!",
  },
  {
    kind: "student",
    title: "AI-Powered Automation",
    accent: "#3b82f6",
    border: "rgba(59,130,246,0.22)",
    text: "No more manually writing JSON test cases! The AI generates comprehensive tests automatically — saves hours of repetitive work.",
  },
  {
    kind: "student",
    title: "Perfect for Learning",
    accent: "#818cf8",
    border: "rgba(129,140,248,0.22)",
    text: "Intuitive and doesn't need deep technical knowledge. I can experiment with different test types and see real results instantly.",
  },
  {
    kind: "student",
    title: "Reducing Manual Work",
    accent: "#22d3ee",
    border: "rgba(34,211,238,0.22)",
    text: "With 25+ AI features the platform automates most tedious work. Test multiple APIs quickly and get detailed reports.",
  },
];

export const PIPELINE_STAGES = [
  {
    id: "01",
    label: "DISCOVER",
    color: "#3b82f6",
    dim: "rgba(59,130,246,0.10)",
    items: [
      { text: "API Endpoint", sub: "base URL or OpenAPI spec" },
      { text: "Auto-Discovery", sub: "zero-config endpoint scan" },
      { text: "Schema Detect", sub: "REST · GraphQL · gRPC" },
      { text: "Auth Extraction", sub: "bearer · key · basic · OAuth" },
    ],
  },
  {
    id: "02",
    label: "TEST SUITE",
    color: "#8b5cf6",
    dim: "rgba(139,92,246,0.10)",
    modules: [
      { name: "Functional", c: "#3b82f6" },
      { name: "Smoke", c: "#22c55e" },
      { name: "Performance", c: "#8b5cf6" },
      { name: "Chaos", c: "#f97316" },
      { name: "Fuzz", c: "#ef4444" },
      { name: "Regression", c: "#06b6d4" },
      { name: "Contract", c: "#6366f1" },
      { name: "GraphQL", c: "#e879f9" },
      { name: "Integration", c: "#14b8a6" },
      { name: "FullSend", c: "#ec4899" },
      { name: "Flow Builder", c: "#f59e0b" },
      { name: "Vibe Testing", c: "#a855f7" },
    ],
  },
  {
    id: "03",
    label: "AI ENGINE",
    color: "#06b6d4",
    dim: "rgba(6,182,212,0.10)",
    items: [
      { text: "Root Cause Analysis", sub: "GPT-4 failure diagnosis" },
      { text: "Natural Language", sub: "describe → test cases" },
      { text: "Predictive AI", sub: "pattern-based forecasting" },
      { text: "Auto Assertions", sub: "AI-generated validations" },
    ],
  },
  {
    id: "04",
    label: "DELIVER",
    color: "#10b981",
    dim: "rgba(16,185,129,0.10)",
    items: [
      { text: "Live Streaming", sub: "SSE real-time feed" },
      { text: "PDF Reports", sub: "stakeholder-ready" },
      { text: "GitHub Push", sub: "native repo commits" },
      { text: "Team Workspace", sub: "share · collaborate" },
    ],
  },
];

export const FAQ_ITEMS = [
  {
    q: "What is Flasqo?",
    a: "Flasqo is a free AI-powered API testing platform. Paste your API URL and it auto-discovers endpoints, generates a full test suite — happy-path, edge-case, negative and security tests — and runs functional, smoke, performance, regression, contract, GraphQL, fuzz and chaos tests from one dashboard.",
  },
  {
    q: "Is Flasqo free to use?",
    a: "Yes. Flasqo is free to use with unlimited test runs and no credit card required.",
  },
  {
    q: "How is Flasqo different from Postman?",
    a: "Postman is built around manually created request collections and hand-written test scripts. Flasqo generates test suites automatically with AI and bundles performance, chaos, fuzz, contract and GraphQL testing into the same platform, so you don't need separate tools like JMeter or custom scripts.",
    link: {
      href: "/compare/flasqo-vs-postman/",
      label: "Read the full Flasqo vs Postman comparison →",
    },
  },
  {
    q: "Do I have to write test cases manually?",
    a: "No. Flasqo's AI generates 10–100 test cases per endpoint covering happy paths, edge cases, negative inputs and security checks. You can review, edit and add your own custom cases before running.",
  },
  {
    q: "Can Flasqo test GraphQL APIs?",
    a: "Yes. Flasqo has a dedicated GraphQL testing module that understands your schema and generates tests for queries and mutations, alongside REST testing.",
    link: {
      href: "/guides/graphql-api-testing/",
      label: "GraphQL API testing guide →",
    },
  },
  {
    q: "Does Flasqo work in CI/CD pipelines?",
    a: "Yes. Smoke tests are designed for fast deployment validation, the Production Gate module blocks risky deploys, and results can be saved to GitHub repositories via the built-in integration.",
  },
  {
    q: "Which authentication methods does Flasqo support?",
    a: "Flasqo supports Bearer tokens, API keys and Basic authentication for testing protected APIs.",
  },
];

export const DIFFERENTIATORS = [
  {
    title: "Zero-Config Setup",
    description:
      "Just paste your API URL - auto-discovery finds all endpoints, detects auth, and generates tests automatically",
    icon: Search,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    title: "90% Less Manual Work",
    description:
      "AI generates comprehensive test suites in seconds - what took hours now takes minutes",
    icon: Brain,
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    title: "Live Progress Streaming",
    description:
      "Watch every request and response in real-time with SSE streaming - no more waiting blindly",
    icon: Eye,
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    title: "Enterprise Security",
    description:
      "Google & GitHub OAuth, JWT sessions, encrypted storage - your tests and data are protected",
    icon: Shield,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    title: "Built-in Collaboration",
    description:
      "Create teams, invite members, share test suites - perfect for agile development teams",
    icon: Users,
    gradient: "from-orange-500 to-red-600",
  },
  {
    title: "Stakeholder-Ready Reports",
    description:
      "Export professional PDF reports with charts and metrics - impress clients and managers",
    icon: FileText,
    gradient: "from-green-500 to-emerald-600",
  },
];
