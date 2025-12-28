import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Zap,
  Shield,
  FileCheck,
  TrendingUp,
  User,
  LogOut,
  ArrowRight,
  CheckCircle,
  Bug,
  GitCompare,
  FileText,
  Database
} from 'lucide-react';

function TestingTypesLanding({ user, onLogout }) {
  const navigate = useNavigate();

  const testingTypes = [
    {
      id: 'functional',
      title: 'Functional API Testing',
      description: 'AI-powered test generation for REST APIs with comprehensive test coverage including happy path, edge cases, negative tests, and security testing.',
      icon: FileCheck,
      gradient: 'from-blue-600 via-purple-600 to-pink-600',
      features: [
        'AI-Powered Test Generation',
        'Security Test Cases',
        'Custom Test Editor',
        'Multiple Auth Methods',
        'Detailed Reports'
      ],
      route: '/functional',
      color: 'blue'
    },
    {
      id: 'smoke',
      title: 'Smoke Testing',
      description: 'Quick health checks for critical API endpoints to verify system readiness. Fast execution for deployment gates and CI/CD pipelines.',
      icon: Zap,
      gradient: 'from-green-600 via-emerald-600 to-teal-600',
      features: [
        'Fast Health Checks (< 5 min)',
        'Critical Endpoint Testing',
        'Go/No-Go Decisions',
        'Quick Presets',
        'Deployment Gates'
      ],
      route: '/smoke',
      color: 'green'
    },
    {
      id: 'performance',
      title: 'Performance Testing',
      description: 'Load testing, stress testing, and response time analysis to ensure your API can handle real-world traffic and identify bottlenecks.',
      icon: Activity,
      gradient: 'from-purple-600 via-pink-600 to-orange-500',
      features: [
        'Response Time Analysis',
        'Load Testing (100-1000 users)',
        'Stress Testing',
        'Spike Testing',
        'Endurance Testing'
      ],
      route: '/performance',
      color: 'purple'
    },
    {
      id: 'chaos',
      title: 'Chaos Testing',
      description: 'Test your API resilience by injecting failures, timeouts, and network issues to ensure your system can handle unexpected scenarios.',
      icon: AlertTriangle,
      gradient: 'from-orange-600 via-red-600 to-pink-600',
      features: [
        'Timeout Injection',
        'Error Simulation (500, 503)',
        'Network Failure Testing',
        'High Latency Testing',
        'Random Error Mix'
      ],
      route: '/chaos',
      color: 'orange'
    },
    {
      id: 'fuzz',
      title: 'Fuzz Testing',
      description: 'Advanced security testing using malformed and random inputs to discover vulnerabilities like buffer overflows, injection attacks, and memory corruption.',
      icon: Bug,
      gradient: 'from-red-600 via-orange-600 to-yellow-600',
      features: [
        'Buffer Overflow Detection',
        'Injection Attack Testing',
        'Type Confusion Tests',
        'Memory Corruption Detection',
        '30+ Attack Vectors'
      ],
      route: '/fuzz',
      color: 'red'
    },
    {
      id: 'regression',
      title: 'Regression Testing',
      description: 'Detect API changes and prevent regressions by comparing current responses against saved baselines. Track changes over time and ensure API stability.',
      icon: GitCompare,
      gradient: 'from-cyan-600 via-indigo-600 to-blue-600',
      features: [
        'Baseline Comparison',
        'Change Detection',
        'Response Validation',
        'Historical Tracking',
        'Automated Alerts'
      ],
      route: '/regression',
      color: 'cyan'
    },
    {
      id: 'contract',
      title: 'Contract Testing',
      description: 'Consumer-Driven Contract testing to ensure service providers meet consumer expectations. Verify API contracts and prevent breaking changes in microservices.',
      icon: FileText,
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
      features: [
        'Consumer-Driven Contracts',
        'Provider Verification',
        'Schema Validation',
        'Breaking Change Detection',
        'Contract Versioning'
      ],
      route: '/contract',
      color: 'violet'
    },
    {
      id: 'graphql',
      title: 'GraphQL API Testing',
      description: 'AI-powered GraphQL testing with automatic schema introspection, query/mutation generation, N+1 detection, and deep nested query testing.',
      icon: Database,
      gradient: 'from-indigo-600 via-blue-600 to-cyan-600',
      features: [
        'Auto Schema Discovery',
        'AI Query Generation',
        'N+1 Detection',
        'Nested Query Testing',
        'Performance Analysis'
      ],
      route: '/graphql',
      color: 'indigo'
    }
  ];

  const handleNavigate = (route) => {
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 via-purple-900/50 to-pink-900/50 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Evo-TFX</h1>
                <p className="text-xs text-blue-300">by EvoluneEdgeTech</p>
              </div>
            </div>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user.username}</div>
                    <div className="text-xs text-blue-200">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg hover:shadow-red-500/30"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-400/30 mb-6">
            <Shield className="text-blue-400" size={20} />
            <span className="text-blue-200 text-sm font-semibold">Enterprise-Grade Testing Platform</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
            Choose Your Testing Strategy
          </h1>

          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Select the type of testing that best fits your needs. Each module is designed to provide
            comprehensive insights into different aspects of your API's performance and reliability.
          </p>
        </div>

        {/* Testing Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {testingTypes.map((testType) => {
            const Icon = testType.icon;
            return (
              <div
                key={testType.id}
                className="group bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-300 overflow-hidden hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-105 cursor-pointer"
                onClick={() => handleNavigate(testType.route)}
              >
                {/* Card Header with Gradient */}
                <div className={`bg-gradient-to-r ${testType.gradient} p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon size={32} className="text-white" />
                    </div>
                    <ArrowRight
                      size={24}
                      className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{testType.title}</h3>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    {testType.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-3 mb-6">
                    <div className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Key Features
                    </div>
                    {testType.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleNavigate(testType.route)}
                    className={`w-full py-3 bg-gradient-to-r ${testType.gradient} text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:shadow-${testType.color}-500/50`}
                  >
                    <span>Start Testing</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-blue-400/30 rounded-2xl p-8 backdrop-blur-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="text-blue-400" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">
                Not sure where to start?
              </h3>
              <p className="text-gray-300 mb-4">
                We recommend a comprehensive testing strategy: Start with <strong className="text-white">Smoke Testing</strong> for
                quick health checks, then use <strong className="text-white">Functional Testing</strong> to validate behavior,
                followed by <strong className="text-white">Performance Testing</strong> to ensure scalability,
                <strong className="text-white"> Chaos Testing</strong> for resilience validation, <strong className="text-white">Fuzz Testing</strong> for security vulnerability detection, <strong className="text-white">Regression Testing</strong> to prevent API changes, and <strong className="text-white">Contract Testing</strong> to ensure service compatibility.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-lg border border-green-400/30">
                  <span className="text-2xl font-bold text-green-400">1</span>
                  <span className="text-sm text-gray-300">Smoke Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-lg border border-blue-400/30">
                  <span className="text-2xl font-bold text-blue-400">2</span>
                  <span className="text-sm text-gray-300">Functional Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-lg border border-purple-400/30">
                  <span className="text-2xl font-bold text-purple-400">3</span>
                  <span className="text-sm text-gray-300">Performance Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-lg border border-orange-400/30">
                  <span className="text-2xl font-bold text-orange-400">4</span>
                  <span className="text-sm text-gray-300">Chaos Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 rounded-lg border border-red-400/30">
                  <span className="text-2xl font-bold text-red-400">5</span>
                  <span className="text-sm text-gray-300">Fuzz Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-lg border border-cyan-400/30">
                  <span className="text-2xl font-bold text-cyan-400">6</span>
                  <span className="text-sm text-gray-300">Regression Testing</span>
                </div>
                <ArrowRight className="text-gray-400 mt-2" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 rounded-lg border border-violet-400/30">
                  <span className="text-2xl font-bold text-violet-400">7</span>
                  <span className="text-sm text-gray-300">Contract Testing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-white/10">
        <div className="text-center text-gray-400 text-sm">
          <p className="font-bold">Evo-TFX</p>
          <p className="text-xs text-gray-500">by EvoluneEdgeTech</p>
          <p className="mt-2">Professional API Testing Platform - Comprehensive testing for modern APIs</p>
        </div>
      </div>
    </div>
  );
}

export default TestingTypesLanding;
