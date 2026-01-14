import React, { useState, useEffect } from 'react';
import {
  Zap,
  Shield,
  Activity,
  TrendingUp,
  Users,
  CheckCircle,
  Star,
  Globe,
  Code,
  Cpu,
  Rocket,
  BarChart3,
  Lock,
  GitBranch,
  Terminal,
  Sparkles,
  ArrowRight,
  Github,
  Twitter,
  Linkedin,
  Mail,
  FileCheck,
  AlertTriangle,
  Clock,
  Bug,
  GitCompare,
  FileText,
  Database,
  Target,
  Layers,
  Brain,
  X
} from 'lucide-react';
import AuthModal from './AuthModal';
import Toast from './Toast';

const LandingPage = ({ onLoginSuccess, authError }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [toast, setToast] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showVersionPopup, setShowVersionPopup] = useState(true);

  // Show error toast if OAuth failed
  useEffect(() => {
    if (authError) {
      setToast({
        message: authError,
        type: 'error'
      });
    }
  }, [authError]);

  // Check if user has seen the version popup before
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('hasSeenVersionPopup');
    if (hasSeenPopup) {
      setShowVersionPopup(false);
    }
  }, []);

  // Auto-hide version popup after 10 seconds and mark as seen
  useEffect(() => {
    if (showVersionPopup) {
      const timer = setTimeout(() => {
        setShowVersionPopup(false);
        localStorage.setItem('hasSeenVersionPopup', 'true');
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [showVersionPopup]);
  const [stats, setStats] = useState({
    users: 0,
    testsRun: 0,
    apisSecured: 0,
    uptime: 0
  });

  // Animate stats counting up
  useEffect(() => {
    const targetStats = {
      users: 15,
      testsRun: 1000,
      apisSecured: 10,
      uptime: 99.9
    };

    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setStats({
        users: Math.floor(targetStats.users * progress),
        testsRun: Math.floor(targetStats.testsRun * progress),
        apisSecured: Math.floor(targetStats.apisSecured * progress),
        uptime: (targetStats.uptime * progress).toFixed(1)
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setStats(targetStats);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Testing',
      description: 'Generate comprehensive test suites automatically with advanced AI algorithms for REST APIs',
      gradient: 'from-blue-500 to-purple-600',
      delay: '0'
    },
    {
      icon: Shield,
      title: 'Security Testing',
      description: 'Built-in security testing and vulnerability scanning to identify threats before production',
      gradient: 'from-cyan-500 to-blue-600',
      delay: '100'
    },
    {
      icon: Activity,
      title: 'Performance Testing',
      description: 'Load, stress, spike and endurance testing to ensure your API scales under pressure',
      gradient: 'from-purple-500 to-pink-600',
      delay: '200'
    },
    {
      icon: AlertTriangle,
      title: 'Chaos Engineering',
      description: 'Test system resilience with controlled failure injection, timeouts, and network issues',
      gradient: 'from-orange-500 to-red-600',
      delay: '0'
    },
    {
      icon: Zap,
      title: 'Smoke Testing',
      description: 'Quick health checks for critical endpoints in CI/CD pipelines - fast execution under 5 minutes',
      gradient: 'from-green-500 to-emerald-600',
      delay: '100'
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description: 'Detailed reports and metrics to track API health, response times, and success rates over time',
      gradient: 'from-indigo-500 to-purple-600',
      delay: '200'
    },
    {
      icon: Bug,
      title: 'Fuzz Testing',
      description: 'Advanced security testing with malformed inputs to discover vulnerabilities and injection attacks',
      gradient: 'from-red-500 to-orange-600',
      delay: '0'
    },
    {
      icon: GitCompare,
      title: 'Regression Testing',
      description: 'Detect API changes and prevent regressions by comparing responses against saved baselines',
      gradient: 'from-cyan-500 to-indigo-600',
      delay: '100'
    },
    {
      icon: FileText,
      title: 'Contract Testing',
      description: 'Consumer-driven contract testing for microservices to prevent breaking changes',
      gradient: 'from-violet-500 to-fuchsia-600',
      delay: '200'
    },
    {
      icon: Database,
      title: 'GraphQL Testing',
      description: 'AI-powered GraphQL testing with automatic schema introspection and N+1 detection',
      gradient: 'from-indigo-500 to-blue-600',
      delay: '0'
    },
    {
      icon: Github,
      title: 'GitHub Integration',
      description: 'Seamlessly save and version your test results directly to GitHub repositories',
      gradient: 'from-slate-600 to-gray-700',
      delay: '100'
    },
    {
      icon: Layers,
      title: 'Multi-Auth Support',
      description: 'Support for Bearer tokens, API keys, OAuth, and custom authentication methods',
      gradient: 'from-teal-500 to-cyan-600',
      delay: '200'
    }
  ];

  const testingTypes = [
    {
      name: 'Functional Testing',
      icon: FileCheck,
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      description: 'AI-powered comprehensive API validation',
      delay: '0'
    },
    {
      name: 'Smoke Testing',
      icon: Zap,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      description: 'Quick critical health checks',
      delay: '100'
    },
    {
      name: 'Performance Testing',
      icon: Activity,
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      description: 'Load & stress analysis',
      delay: '200'
    },
    {
      name: 'Chaos Testing',
      icon: AlertTriangle,
      color: 'orange',
      gradient: 'from-orange-500 to-red-500',
      description: 'Resilience validation',
      delay: '300'
    },
    {
      name: 'Fuzz Testing',
      icon: Bug,
      color: 'red',
      gradient: 'from-red-500 to-orange-600',
      description: 'Security vulnerability detection',
      delay: '0'
    },
    {
      name: 'Regression Testing',
      icon: GitCompare,
      color: 'cyan',
      gradient: 'from-cyan-500 to-indigo-500',
      description: 'Change detection & tracking',
      delay: '100'
    },
    {
      name: 'Contract Testing',
      icon: FileText,
      color: 'violet',
      gradient: 'from-violet-500 to-fuchsia-500',
      description: 'Microservices contract validation',
      delay: '200'
    },
    {
      name: 'GraphQL Testing',
      icon: Database,
      color: 'indigo',
      gradient: 'from-indigo-500 to-blue-500',
      description: 'Schema introspection & queries',
      delay: '300'
    }
  ];

  const differentiators = [
    {
      title: 'AI-First Approach',
      description: 'Unlike traditional tools, we use AI to automatically generate test cases, reducing manual effort by 90%',
      icon: Brain,
      gradient: 'from-blue-500 to-purple-600'
    },
    {
      title: 'All-in-One Platform',
      description: 'Functional, Performance, Chaos, and Smoke testing in one unified platform - no need for multiple tools',
      icon: Layers,
      gradient: 'from-purple-500 to-pink-600'
    },
    {
      title: 'Developer Friendly',
      description: 'Modern UI, easy integration, and comprehensive documentation. Built by developers, for developers',
      icon: Code,
      gradient: 'from-cyan-500 to-blue-600'
    },
    {
      title: 'Cost Effective',
      description: 'Enterprise-grade features at a fraction of the cost of competitors like Postman Pro or Katalon',
      icon: TrendingUp,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      title: 'GitHub Integration',
      description: 'Seamlessly save and version your test results directly to GitHub repositories',
      icon: GitBranch,
      gradient: 'from-slate-600 to-gray-700'
    },
    {
      title: 'Real-time Insights',
      description: 'Live test execution with detailed logs and metrics - see what\'s happening as it happens',
      icon: Activity,
      gradient: 'from-orange-500 to-red-600'
    }
  ];

  const testimonials = [
    {
      name: 'Karthik',
      role: 'Tester',
      company: '',
      image: 'K',
      text: 'It\'s a nice platform with more than 20 AI features, makes manual work more easy in API testing.',
      rating: 5
    },
    {
      name: 'Aman',
      role: 'Automation Architect',
      company: '',
      image: 'A',
      text: 'It\'s nice to see a platform which contains 8 different testing types with 25+ AI features. I have tested this with 10 APIs and results are pretty accurate upto 90%. Good job!',
      rating: 5
    },
    {
      name: 'Adarsh',
      role: 'Solution Architect',
      company: '',
      image: 'AD',
      text: 'Unified with all testing types, and this was something which was required.',
      rating: 5
    }
  ];

  const handleGetStarted = (mode = 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (userData) => {
    // Close the modal
    setShowAuthModal(false);

    // Show success toast
    setToast({
      message: `🎉 Welcome back, ${userData.username}! Redirecting to your dashboard...`,
      type: 'success'
    });

    // Add fade out effect to landing page
    setIsTransitioning(true);

    // Wait for toast to be visible, then redirect
    setTimeout(() => {
      onLoginSuccess(userData);
    }, 2000);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 bg-slate-900/70 backdrop-blur-xl border-b border-white/20 sticky top-0 shadow-lg shadow-purple-500/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 group-hover:shadow-purple-500/80 transition-all duration-300 group-hover:scale-110">
                <Shield size={26} className="text-white absolute" />
                <Activity size={16} className="text-white absolute bottom-1 right-1 opacity-80" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-purple-400 group-hover:via-pink-400 group-hover:to-blue-400 transition-all duration-500">
                  Evo-TFX
                </h1>
                <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">by EvoluneEdgeTech</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="relative text-gray-300 hover:text-white transition-colors font-medium group">
                Features
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#why-us" className="relative text-gray-300 hover:text-white transition-colors font-medium group">
                Why Us
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#testimonials" className="relative text-gray-300 hover:text-white transition-colors font-medium group">
                Testimonials
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#pricing" className="relative text-gray-300 hover:text-white transition-colors font-medium group">
                Pricing
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300"></span>
              </a>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleGetStarted('login')}
                className="px-6 py-2.5 text-white hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/30 font-medium"
              >
                Login
              </button>
              <button
                onClick={() => handleGetStarted('signup')}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-lg hover:shadow-xl hover:shadow-purple-500/50 transition-all font-semibold hover:scale-105 transform"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-400/30 rounded-full mb-6 animate-bounce">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">AI-Powered API Testing Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-5 leading-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Test Smarter,
            </span>
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Ship Faster
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            The complete API testing platform with AI-powered test generation, performance testing,
            chaos engineering, and real-time analytics. Built for modern development teams.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <button
              onClick={() => handleGetStarted('signup')}
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <span>Start Testing Now</span>
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </button>
            <button
              onClick={() => document.getElementById('demo-video').scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-bold text-lg hover:bg-white/20 transition-all"
            >
              Watch Demo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stats.users.toLocaleString()}+
              </div>
              <div className="text-sm text-gray-400">Active Users</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                {stats.testsRun.toLocaleString()}+
              </div>
              <div className="text-sm text-gray-400">Tests Run</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                {stats.apisSecured.toLocaleString()}+
              </div>
              <div className="text-sm text-gray-400">APIs Secured</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                {stats.uptime}%
              </div>
              <div className="text-sm text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-full mb-4">
            <Sparkles size={16} className="text-blue-400 animate-pulse" />
            <span className="text-sm font-semibold text-blue-300">12+ Powerful Features</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient" style={{ backgroundSize: '200% 200%' }}>
            Complete Testing Arsenal
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Everything you need to test, monitor, and secure your APIs in one unified platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                style={{ animationDelay: `${feature.delay}ms` }}
                className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-500 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 animate-slide-up overflow-hidden"
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"
                     style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}></div>

                {/* Animated border gradient */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: `linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.3), transparent)`, padding: '1px' }}></div>

                <div className="relative z-10">
                  {/* Icon with rotating gradient background */}
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                    <Icon size={28} className="text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text transition-all duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
                    {feature.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="mt-4 flex items-center gap-2 text-purple-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <span className="text-xs font-semibold">Learn More</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional decorative elements */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </section>

      {/* Testing Types */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/30 border-2 border-purple-400/50 rounded-full mb-4 shadow-lg shadow-purple-500/50 animate-glow" style={{ animation: 'glow 2s ease-in-out infinite alternate' }}>
            <Target size={18} className="text-purple-300 animate-pulse" />
            <span className="text-sm font-bold text-purple-200">8 Specialized Testing Modules</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent animate-gradient" style={{ backgroundSize: '200% 200%' }}>
            Complete Testing Suite
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Comprehensive API validation across all testing dimensions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {testingTypes.map((type, index) => {
            const Icon = type.icon;
            return (
              <div
                key={index}
                onClick={() => handleGetStarted('signup')}
                style={{ animationDelay: `${type.delay}ms` }}
                className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-center hover:border-white/40 transition-all duration-500 hover:transform hover:scale-110 hover:shadow-2xl hover:-translate-y-2 animate-slide-up overflow-hidden cursor-pointer"
              >
                {/* Animated background glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${type.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl blur-xl`}></div>

                {/* Rotating border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{
                       background: `conic-gradient(from 0deg, transparent, ${type.color === 'blue' ? '#3b82f6' : type.color === 'green' ? '#10b981' : type.color === 'purple' ? '#a855f7' : type.color === 'orange' ? '#f97316' : type.color === 'red' ? '#ef4444' : type.color === 'cyan' ? '#06b6d4' : type.color === 'violet' ? '#8b5cf6' : '#6366f1'}, transparent)`,
                       animation: 'spin 3s linear infinite'
                     }}></div>

                <div className="relative z-10">
                  {/* Icon with pulsing animation */}
                  <div className={`w-20 h-20 bg-gradient-to-br ${type.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-lg group-hover:shadow-2xl animate-float`}>
                    <Icon size={36} className="text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Title with gradient on hover */}
                  <h3 className="text-lg font-bold mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 group-hover:bg-clip-text transition-all duration-300">
                    {type.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors duration-300">
                    {type.description}
                  </p>

                  {/* Hover arrow indicator */}
                  <div className="mt-3 flex items-center justify-center gap-1 text-purple-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <span className="text-xs font-semibold">Explore</span>
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-10 right-1/4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 left-1/3 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            Why Choose Evo-TFX?
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            What makes us different from other API testing platforms
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {differentiators.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-500 hover:transform hover:scale-105 hover:shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}>
                    <Icon size={26} className="text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text transition-all duration-300">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
            Loved by Professionals
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See what industry experts say about Evo-TFX
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10 hover:border-white/30 transition-all"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed italic">"{testimonial.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-white">
                  {testimonial.image}
                </div>
                <div>
                  <div className="font-bold">{testimonial.name}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Student Community Reviews */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-400/30 rounded-full mb-4">
            <Users size={16} className="text-green-400 animate-pulse" />
            <span className="text-sm font-semibold text-green-300">Student Community</span>
          </div>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Reviews from Students
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Students exploring and learning API testing with Evo-TFX
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-400/20 hover:border-green-400/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={24} className="text-green-400" />
              <div className="font-bold text-lg">Exploring New Testing Types</div>
            </div>
            <p className="text-gray-300 leading-relaxed">
              "Amazing to see multiple testing types like Fuzz, Chaos, and Contract testing all in one place. Never heard of some of these before, but the platform makes it easy to understand and implement them. Great learning resource!"
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-lg rounded-xl p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <Rocket size={24} className="text-blue-400" />
              <div className="font-bold text-lg">AI-Powered Automation</div>
            </div>
            <p className="text-gray-300 leading-relaxed">
              "No more manually writing JSON test cases! The AI generates comprehensive tests automatically. As a student, this saves hours of work and helps me focus on understanding concepts rather than repetitive coding."
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <Code size={24} className="text-purple-400" />
              <div className="font-bold text-lg">Perfect for Learning</div>
            </div>
            <p className="text-gray-300 leading-relaxed">
              "The platform is intuitive and doesn't require deep technical knowledge to get started. I can experiment with different testing types and see real results instantly. Excellent for building practical skills!"
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-orange-400/20 hover:border-orange-400/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={24} className="text-orange-400" />
              <div className="font-bold text-lg">Reducing Manual Work</div>
            </div>
            <p className="text-gray-300 leading-relaxed">
              "Writing test cases used to take forever. With 25+ AI features, the platform automates most of the tedious work. I can test multiple APIs quickly and get detailed reports without spending hours on setup."
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl p-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Transform Your API Testing?</h2>
          <p className="text-lg mb-6 max-w-2xl mx-auto">
            Join thousands of developers who trust Evo-TFX for their API testing needs
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => handleGetStarted('signup')}
              className="px-8 py-4 bg-white text-purple-600 rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => handleGetStarted('login')}
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/30 transition-all"
            >
              Login to Continue
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-900/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                  <Shield size={22} className="text-white absolute" />
                  <Activity size={12} className="text-white absolute bottom-1 right-1 opacity-80" />
                </div>
                <div>
                  <div className="text-xl font-bold">Evo-TFX</div>
                  <div className="text-xs text-gray-500">by EvoluneEdgeTech</div>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                AI-powered API testing platform for modern development teams.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">Connect</h3>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                  <Github size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                  <Twitter size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                  <Linkedin size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                  <Mail size={20} />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 text-center text-sm text-gray-400">
            <p className="mb-1">&copy; 2026 Evo-TFX. All rights reserved. Built for developers.</p>
            <p>
              A product by{' '}
              <a
                href="https://evolune.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-300 hover:underline"
              >
                EvoluneEdgeTech
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Version Popup */}
      {showVersionPopup && (
        <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
          <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-1 shadow-2xl shadow-purple-500/50 animate-glow">
            <div className="bg-slate-900 rounded-xl p-6 relative overflow-hidden">
              {/* Animated background effects */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl animate-pulse delay-500"></div>

              {/* Close button */}
              <button
                onClick={() => {
                  setShowVersionPopup(false);
                  localStorage.setItem('hasSeenVersionPopup', 'true');
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>

              {/* Content */}
              <div className="relative z-10 max-w-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg animate-float">
                    <Rocket size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Hey There! 👋</h3>
                    <p className="text-xs text-purple-300">Exciting News!</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    You're using <span className="font-bold text-blue-400">Evo-TFX Version 1</span>
                  </p>
                  <p className="text-white font-semibold text-base">
                    🚀 Version 2 releasing very soon!
                  </p>
                  <p className="text-purple-300 text-sm font-medium">
                    Stay tuned for amazing new features...
                  </p>
                </div>

                {/* Progress bar for 10 seconds */}
                <div className="mt-4 w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-progress"
                    style={{ width: '0%' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={handleLoginSuccess}
          onSwitchMode={(mode) => setAuthMode(mode)}
        />
      )}
    </div>
  );
};

export default LandingPage;
