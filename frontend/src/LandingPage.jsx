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
  X,
  MessageSquare,
  Copy,
  Search,
  Play,
  Settings,
  Eye
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
      icon: Activity,
      title: 'Real-time Streaming Logs',
      description: 'Watch tests execute live with SSE streaming - see every request, response, and timing as it happens',
      gradient: 'from-green-500 to-emerald-600',
      delay: '0'
    },
    {
      icon: Brain,
      title: 'AI Root Cause Analysis',
      description: 'GPT-4 powered failure analysis with severity classification, business impact, and fix recommendations',
      gradient: 'from-blue-500 to-purple-600',
      delay: '50'
    },
    {
      icon: MessageSquare,
      title: 'Natural Language Tests',
      description: 'Describe tests in plain English - AI converts your words into executable test cases instantly',
      gradient: 'from-purple-500 to-pink-600',
      delay: '100'
    },
    {
      icon: TrendingUp,
      title: 'Predictive Analytics',
      description: 'AI predicts which tests are likely to fail based on patterns and historical data',
      gradient: 'from-orange-500 to-red-600',
      delay: '150'
    },
    {
      icon: FileText,
      title: 'Professional PDF Reports',
      description: 'Export detailed test reports with metrics, charts, and findings - ready for stakeholders',
      gradient: 'from-cyan-500 to-blue-600',
      delay: '200'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Create teams, invite members, share test suites, and collaborate on API testing projects',
      gradient: 'from-violet-500 to-fuchsia-600',
      delay: '250'
    },
    {
      icon: Github,
      title: 'GitHub Native',
      description: 'OAuth integration - save test results directly to repos with custom commit messages',
      gradient: 'from-slate-600 to-gray-700',
      delay: '300'
    },
    {
      icon: Shield,
      title: 'Security Header Analysis',
      description: 'Automatic CORS, CSP, and security header detection with vulnerability scoring',
      gradient: 'from-red-500 to-orange-600',
      delay: '350'
    },
    {
      icon: Layers,
      title: 'Multi-Auth Support',
      description: 'Bearer tokens, API keys, Basic Auth, OAuth - test any protected endpoint easily',
      gradient: 'from-teal-500 to-cyan-600',
      delay: '400'
    },
    {
      icon: Clock,
      title: 'State Persistence',
      description: 'All configurations auto-saved - resume exactly where you left off, even after refresh',
      gradient: 'from-indigo-500 to-purple-600',
      delay: '450'
    },
    {
      icon: Copy,
      title: 'One-Click Sharing',
      description: 'Copy test results, analysis, and configurations to clipboard instantly for sharing',
      gradient: 'from-pink-500 to-rose-600',
      delay: '500'
    },
    {
      icon: Zap,
      title: 'Batch Execution',
      description: 'Run and analyze multiple tests simultaneously with parallel execution support',
      gradient: 'from-amber-500 to-orange-600',
      delay: '550'
    }
  ];

  const testingTypes = [
    {
      name: 'Auto-Discovery',
      icon: Search,
      color: 'emerald',
      gradient: 'from-emerald-500 to-teal-500',
      description: 'Zero-config API detection',
      delay: '0'
    },
    {
      name: 'Functional',
      icon: FileCheck,
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      description: 'AI-powered validation',
      delay: '50'
    },
    {
      name: 'Smoke',
      icon: Zap,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      description: 'Quick health checks',
      delay: '100'
    },
    {
      name: 'Performance',
      icon: Activity,
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      description: 'Load & stress testing',
      delay: '150'
    },
    {
      name: 'Chaos',
      icon: AlertTriangle,
      color: 'orange',
      gradient: 'from-orange-500 to-red-500',
      description: 'Resilience validation',
      delay: '200'
    },
    {
      name: 'Fuzz',
      icon: Bug,
      color: 'red',
      gradient: 'from-red-500 to-orange-600',
      description: 'Security scanning',
      delay: '250'
    },
    {
      name: 'Regression',
      icon: GitCompare,
      color: 'cyan',
      gradient: 'from-cyan-500 to-indigo-500',
      description: 'Change detection',
      delay: '300'
    },
    {
      name: 'Contract',
      icon: FileText,
      color: 'violet',
      gradient: 'from-violet-500 to-fuchsia-500',
      description: 'API contracts',
      delay: '350'
    },
    {
      name: 'GraphQL',
      icon: Database,
      color: 'indigo',
      gradient: 'from-indigo-500 to-blue-500',
      description: 'Schema & queries',
      delay: '400'
    }
  ];

  const differentiators = [
    {
      title: 'Zero-Config Setup',
      description: 'Just paste your API URL - auto-discovery finds all endpoints, detects auth, and generates tests automatically',
      icon: Search,
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      title: '90% Less Manual Work',
      description: 'AI generates comprehensive test suites in seconds - what took hours now takes minutes',
      icon: Brain,
      gradient: 'from-blue-500 to-purple-600'
    },
    {
      title: 'Live Progress Streaming',
      description: 'Watch every request and response in real-time with SSE streaming - no more waiting blindly',
      icon: Eye,
      gradient: 'from-cyan-500 to-blue-600'
    },
    {
      title: 'Enterprise Security',
      description: 'Google & GitHub OAuth, JWT sessions, encrypted storage - your tests and data are protected',
      icon: Shield,
      gradient: 'from-purple-500 to-pink-600'
    },
    {
      title: 'Built-in Collaboration',
      description: 'Create teams, invite members, share test suites - perfect for agile development teams',
      icon: Users,
      gradient: 'from-orange-500 to-red-600'
    },
    {
      title: 'Stakeholder-Ready Reports',
      description: 'Export professional PDF reports with charts and metrics - impress clients and managers',
      icon: FileText,
      gradient: 'from-green-500 to-emerald-600'
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

      {/* Navigation - Creative Floating Design */}
      <nav className="relative z-50 sticky top-0">
        {/* Navbar background with glassmorphism */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />

        {/* Animated aurora bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent" style={{ animation: 'navAuroraSlide 3s ease-in-out infinite' }} />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent" style={{ animation: 'navAuroraSlide 3s ease-in-out 1s infinite' }} />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500 to-transparent" style={{ animation: 'navAuroraSlide 3s ease-in-out 2s infinite' }} />
        </div>

        {/* Floating particles in navbar */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-2 left-[20%] w-1 h-1 bg-blue-400/40 rounded-full" style={{ animation: 'navParticle 4s ease-in-out infinite' }} />
          <div className="absolute top-4 left-[40%] w-1.5 h-1.5 bg-purple-400/30 rounded-full" style={{ animation: 'navParticle 5s ease-in-out 1s infinite' }} />
          <div className="absolute top-3 left-[60%] w-1 h-1 bg-pink-400/40 rounded-full" style={{ animation: 'navParticle 4.5s ease-in-out 0.5s infinite' }} />
          <div className="absolute top-5 left-[80%] w-1 h-1 bg-cyan-400/30 rounded-full" style={{ animation: 'navParticle 3.5s ease-in-out 1.5s infinite' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo with orbital ring */}
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                {/* Outer orbital ring */}
                <div
                  className="absolute -inset-2 rounded-full border border-purple-500/30 group-hover:border-purple-400/50 transition-colors"
                  style={{ animation: 'logoOrbit 8s linear infinite' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full shadow-lg shadow-purple-500/50" />
                </div>

                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl opacity-0 group-hover:opacity-50 blur-lg transition-all duration-500" />

                {/* Logo container */}
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 group-hover:shadow-purple-500/80 transition-all duration-300 group-hover:scale-110 overflow-hidden">
                  {/* Shine sweep */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Shield size={26} className="text-white relative z-10" />
                  <Activity size={14} className="text-white/80 absolute bottom-1 right-1" />
                </div>
              </div>

              <div className="relative">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" style={{ backgroundSize: '200% 200%', animation: 'navGradientShift 4s ease-in-out infinite' }}>
                  Evo-TFX
                </h1>
                <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors flex items-center gap-1">
                  by EvoluneEdgeTech
                  <span className="inline-block w-1 h-1 bg-green-400 rounded-full" style={{ animation: 'navPulse 2s ease-in-out infinite' }} />
                </p>
              </div>
            </div>

            {/* Navigation links as floating pills */}
            <div className="hidden md:flex items-center gap-2">
              {[
                { href: '#features', label: 'Features', gradient: 'from-blue-500 to-cyan-500' },
                { href: '#why-us', label: 'Why Us', gradient: 'from-purple-500 to-pink-500' },
                { href: '#testimonials', label: 'Testimonials', gradient: 'from-pink-500 to-orange-500' },
                { href: '#pricing', label: 'Pricing', gradient: 'from-emerald-500 to-teal-500' }
              ].map((item, index) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group relative px-4 py-2 rounded-full transition-all duration-300"
                  style={{ animation: `navItemFloat 3s ease-in-out ${index * 0.2}s infinite` }}
                >
                  {/* Hover background */}
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />

                  {/* Border that appears on hover */}
                  <div className={`absolute inset-0 rounded-full border border-transparent group-hover:border-white/20 transition-colors duration-300`} />

                  {/* Active indicator dot */}
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-100 scale-0`} />

                  <span className="relative text-gray-300 group-hover:text-white transition-colors font-medium text-sm">
                    {item.label}
                  </span>
                </a>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {/* Login button with orbital effect */}
              <button
                onClick={() => handleGetStarted('login')}
                className="group relative px-5 py-2.5 rounded-full font-medium overflow-hidden transition-all duration-300"
              >
                {/* Border */}
                <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />

                {/* Hover fill */}
                <div className="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/10 transition-colors" />

                {/* Orbiting dot on hover */}
                <div
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ animation: 'logoOrbit 3s linear infinite' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/50 rounded-full" />
                </div>

                <span className="relative text-white text-sm">Login</span>
              </button>

              {/* Get Started button with animated gradient */}
              <button
                onClick={() => handleGetStarted('signup')}
                className="group relative px-6 py-2.5 rounded-full font-semibold overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
              >
                {/* Animated gradient background */}
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"
                  style={{ backgroundSize: '200% 200%', animation: 'navGradientShift 3s ease-in-out infinite' }}
                />

                {/* Shine sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                {/* Glow pulse */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-50 blur-md transition-opacity" />

                <span className="relative text-white text-sm flex items-center gap-2">
                  Get Started Free
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Navbar animations */}
        <style>{`
          @keyframes navAuroraSlide {
            0%, 100% { transform: translateX(-100%); opacity: 0; }
            50% { transform: translateX(100%); opacity: 1; }
          }
          @keyframes navParticle {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
            25% { transform: translateY(-5px) translateX(5px); opacity: 0.6; }
            50% { transform: translateY(0) translateX(10px); opacity: 0.3; }
            75% { transform: translateY(5px) translateX(5px); opacity: 0.6; }
          }
          @keyframes logoOrbit {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes navGradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes navPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.5); }
          }
          @keyframes navItemFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
        `}</style>
      </nav>

      {/* Hero Section - Creative Design */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-16 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Floating geometric shapes */}
          <div className="absolute top-20 left-[10%] w-24 h-24 border border-purple-500/20 rounded-2xl rotate-12" style={{ animation: 'heroFloat1 8s ease-in-out infinite' }} />
          <div className="absolute top-40 right-[15%] w-16 h-16 border border-blue-500/20 rounded-full" style={{ animation: 'heroFloat2 6s ease-in-out infinite' }} />
          <div className="absolute bottom-40 left-[20%] w-12 h-12 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl rotate-45" style={{ animation: 'heroFloat3 7s ease-in-out infinite' }} />
          <div className="absolute top-1/3 right-[8%] w-20 h-20 border border-cyan-500/10 rounded-full" style={{ animation: 'heroFloat1 9s ease-in-out infinite reverse' }} />

          {/* Floating code snippets */}
          <div className="hidden md:block absolute top-32 left-[5%] text-xs font-mono text-purple-500/40 bg-purple-500/5 px-3 py-1.5 rounded-lg border border-purple-500/10" style={{ animation: 'heroFloat2 10s ease-in-out infinite' }}>
            {'{ status: 200 }'}
          </div>
          <div className="hidden md:block absolute bottom-48 right-[5%] text-xs font-mono text-blue-500/40 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10" style={{ animation: 'heroFloat3 8s ease-in-out infinite' }}>
            {'POST /api/test'}
          </div>
          <div className="hidden md:block absolute top-1/2 left-[3%] text-xs font-mono text-green-500/40 bg-green-500/5 px-3 py-1.5 rounded-lg border border-green-500/10" style={{ animation: 'heroFloat1 12s ease-in-out infinite' }}>
            {'✓ All tests passed'}
          </div>

          {/* Glowing orbs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl" style={{ animation: 'pulseGlow 4s ease-in-out infinite' }} />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" style={{ animation: 'pulseGlow 5s ease-in-out infinite reverse' }} />
        </div>

        <div className="relative text-center">
          {/* Badge with animated border */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 mb-8">
            <div className="absolute inset-0 rounded-full" style={{
              background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #3b82f6, #8b5cf6)',
              backgroundSize: '300% 100%',
              animation: 'gradientBorder 3s linear infinite',
              padding: '1px'
            }}>
              <div className="absolute inset-[1px] bg-slate-900 rounded-full" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 opacity-20 blur-md" style={{ animation: 'pulseGlow 2s ease-in-out infinite' }} />
            <Sparkles size={16} className="relative text-purple-400" style={{ animation: 'sparkleRotate 3s ease-in-out infinite' }} />
            <span className="relative text-sm font-semibold bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">AI-Powered API Testing Platform</span>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          {/* Main heading with animation */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span
              className="inline-block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
              style={{ animation: 'titleSlideIn 0.8s ease-out' }}
            >
              Test Smarter,
            </span>
            <br />
            <span
              className="inline-block bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent"
              style={{ animation: 'titleSlideIn 0.8s ease-out 0.2s both' }}
            >
              Ship Faster
            </span>
            {/* Animated underline */}
            <div className="mt-2 mx-auto w-32 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full" style={{ animation: 'underlineExpand 1s ease-out 0.5s both' }} />
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed" style={{ animation: 'fadeInUp 0.8s ease-out 0.4s both' }}>
            The complete API testing platform with AI-powered test generation, performance testing,
            chaos engineering, and real-time analytics. Built for modern development teams.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12" style={{ animation: 'fadeInUp 0.8s ease-out 0.6s both' }}>
            <button
              onClick={() => handleGetStarted('signup')}
              className="group relative px-8 py-4 rounded-full font-bold text-lg overflow-hidden transition-all transform hover:scale-105"
            >
              {/* Button gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" style={{ backgroundSize: '200% 200%', animation: 'gradientBorder 3s linear infinite' }} />
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2 text-white">
                <Zap size={20} />
                Start Testing Now
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </span>
            </button>
            <button
              onClick={() => document.getElementById('demo-video').scrollIntoView({ behavior: 'smooth' })}
              className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
            >
              <Play size={20} className="group-hover:scale-110 transition-transform" />
              Watch Demo
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-8 text-gray-500 text-sm mb-8" style={{ animation: 'fadeInUp 0.8s ease-out 0.8s both' }}>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-green-500" />
              <span>Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-500" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-blue-500" />
              <span>Free Forever Plan</span>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes heroFloat1 {
            0%, 100% { transform: translateY(0) rotate(12deg); }
            50% { transform: translateY(-20px) rotate(20deg); }
          }
          @keyframes heroFloat2 {
            0%, 100% { transform: translateY(0) translateX(0); }
            33% { transform: translateY(-15px) translateX(10px); }
            66% { transform: translateY(5px) translateX(-5px); }
          }
          @keyframes heroFloat3 {
            0%, 100% { transform: translateY(0) rotate(45deg); }
            50% { transform: translateY(-25px) rotate(55deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.1); }
          }
          @keyframes gradientBorder {
            0% { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @keyframes sparkleRotate {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.2); }
          }
          @keyframes titleSlideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes underlineExpand {
            from { width: 0; opacity: 0; }
            to { width: 8rem; opacity: 1; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

          {/* Stats - Creative Floating Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { value: stats.users.toLocaleString(), suffix: '+', label: 'Active Users', gradient: 'from-blue-400 to-cyan-400', glow: '#22d3ee', icon: '👥' },
              { value: stats.testsRun.toLocaleString(), suffix: '+', label: 'Tests Run', gradient: 'from-purple-400 to-pink-400', glow: '#a855f7', icon: '🧪' },
              { value: stats.apisSecured.toLocaleString(), suffix: '+', label: 'APIs Secured', gradient: 'from-green-400 to-emerald-400', glow: '#22c55e', icon: '🔒' },
              { value: stats.uptime, suffix: '%', label: 'Uptime', gradient: 'from-orange-400 to-red-400', glow: '#f97316', icon: '⚡' }
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="group relative"
                style={{ animation: `floatCard 4s ease-in-out ${index * 0.3}s infinite` }}
              >
                {/* Glow effect */}
                <div
                  className="absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"
                  style={{ background: stat.glow }}
                />

                {/* Card */}
                <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 group-hover:border-white/30 transition-all duration-300 overflow-hidden">
                  {/* Animated shine */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  {/* Floating icon */}
                  <div className="absolute -top-2 -right-2 text-2xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ animation: `float ${3 + index}s ease-in-out infinite` }}>
                    {stat.icon}
                  </div>

                  {/* Orbital ring */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full border border-white/10 group-hover:border-white/20 transition-colors" style={{ animation: `spin ${10 + index * 2}s linear infinite` }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: stat.glow }} />
                  </div>

                  {/* Content */}
                  <div className="relative">
                    <div className={`text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-1 group-hover:scale-105 transition-transform origin-left`}>
                      {stat.value}{stat.suffix}
                    </div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{stat.label}</div>
                  </div>

                  {/* Bottom gradient line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${stat.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
                </div>
              </div>
            ))}
          </div>

          <style>{`
            @keyframes floatCard {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
            @keyframes float {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(-5px) rotate(5deg); }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="relative text-center mb-12 animate-fade-in">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute top-0 left-[20%] w-2 h-2 bg-blue-400/50 rounded-full" style={{ animation: 'twinkle 3s ease-in-out infinite' }} />
            <div className="absolute top-10 right-[25%] w-1.5 h-1.5 bg-purple-400/50 rounded-full" style={{ animation: 'twinkle 2s ease-in-out 0.5s infinite' }} />
            <div className="absolute bottom-0 left-[30%] w-1 h-1 bg-pink-400/50 rounded-full" style={{ animation: 'twinkle 2.5s ease-in-out 1s infinite' }} />
          </div>

          {/* Badge with animated border */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 mb-6">
            {/* Rotating gradient border */}
            <div className="absolute inset-0 rounded-full" style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)',
              backgroundSize: '300% 100%',
              animation: 'gradientMove 3s linear infinite',
              padding: '1px'
            }}>
              <div className="absolute inset-[1px] bg-slate-900 rounded-full" />
            </div>
            {/* Glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-md" />
            {/* Content */}
            <Sparkles size={16} className="relative text-blue-400" style={{ animation: 'sparkle 2s ease-in-out infinite' }} />
            <span className="relative text-sm font-semibold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">12+ Powerful Features</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          {/* Main heading with animated text */}
          <h2 className="relative text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" style={{
              backgroundSize: '200% 200%',
              animation: 'gradientShift 4s ease-in-out infinite'
            }}>
              Complete Testing Arsenal
            </span>
            {/* Decorative underline */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </h2>

          {/* Subtitle with icons */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="hidden md:block h-px w-16 bg-gradient-to-r from-transparent to-purple-500/50" />
            <p className="text-lg text-gray-300 max-w-2xl">
              Everything you need to test, monitor, and secure your APIs in one unified platform
            </p>
            <div className="hidden md:block h-px w-16 bg-gradient-to-l from-transparent to-purple-500/50" />
          </div>
        </div>

        <style>{`
          @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes sparkle {
            0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
            50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
          }
        `}</style>

        {/* Creative Feature Orbs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group relative cursor-pointer"
                style={{ animation: `featureFloat 5s ease-in-out ${index * 0.2}s infinite, fadeInUp 0.6s ease-out ${index * 0.05}s both` }}
              >
                {/* Glow effect */}
                <div
                  className={`absolute -inset-2 bg-gradient-to-r ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500`}
                />

                {/* Card */}
                <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-xl p-4 border border-white/10 group-hover:border-white/30 transition-all duration-300 group-hover:scale-105">
                  {/* Floating Icon Orb */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      {/* Orbital ring */}
                      <div
                        className="absolute -inset-2 rounded-full border border-white/10 group-hover:border-white/30 transition-colors"
                        style={{ animation: `spin ${12 + index}s linear infinite` }}
                      >
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.gradient}`} />
                      </div>
                      {/* Icon container */}
                      <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${feature.gradient} p-[2px] shadow-lg group-hover:scale-110 transition-transform`}>
                        <div className="w-full h-full rounded-full bg-slate-900/90 flex items-center justify-center">
                          <Icon size={22} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`text-xs font-bold text-center mb-1 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                    {feature.title}
                  </h3>

                  {/* Short description - hidden by default, show on hover */}
                  <p className="text-[10px] text-gray-500 text-center line-clamp-2 group-hover:text-gray-400 transition-colors">
                    {feature.description.split(' ').slice(0, 6).join(' ')}...
                  </p>

                  {/* Bottom gradient line */}
                  <div className={`absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r ${feature.gradient} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes featureFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </section>

      {/* Testing Types - Creative Orb Design */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center gap-2 px-5 py-2 mb-4">
            <div className="absolute inset-0 rounded-full" style={{
              background: 'linear-gradient(90deg, #a855f7, #ec4899, #f97316, #a855f7)',
              backgroundSize: '300% 100%',
              animation: 'gradientMove 3s linear infinite',
              padding: '1px'
            }}>
              <div className="absolute inset-[1px] bg-slate-900 rounded-full" />
            </div>
            <Target size={16} className="relative text-purple-400" />
            <span className="relative text-sm font-semibold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">9 Specialized Modules</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Complete Testing Suite
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            Comprehensive API validation across all testing dimensions
          </p>
        </div>

        {/* Orbs Grid */}
        <div className="flex flex-wrap justify-center gap-6">
          {testingTypes.map((type, index) => {
            const Icon = type.icon;
            return (
              <div
                key={index}
                onClick={() => handleGetStarted('signup')}
                className="group relative cursor-pointer"
                style={{ animation: `orbFloat 5s ease-in-out ${index * 0.3}s infinite` }}
              >
                {/* Glow effect */}
                <div className={`absolute -inset-3 bg-gradient-to-r ${type.gradient} rounded-full opacity-0 group-hover:opacity-40 blur-2xl transition-all duration-500`} />

                {/* Outer orbital ring */}
                <div
                  className="absolute -inset-2 rounded-full border border-white/10 group-hover:border-white/30 transition-colors"
                  style={{ animation: `spin ${15 + index * 2}s linear infinite` }}
                >
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gradient-to-r ${type.gradient}`} />
                </div>

                {/* Main orb */}
                <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${type.gradient} p-[2px] group-hover:scale-110 transition-all duration-300 shadow-xl`}>
                  <div className="w-full h-full rounded-full bg-slate-900/90 flex items-center justify-center relative overflow-hidden">
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Icon size={32} className="text-white relative z-10" />
                  </div>
                </div>

                {/* Label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                  <span className={`text-xs font-medium bg-gradient-to-r ${type.gradient} bg-clip-text text-transparent`}>
                    {type.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes orbFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </section>

      {/* Why Choose Us - Creative Hexagon Design */}
      <section id="why-us" className="relative z-10 max-w-6xl mx-auto px-6 py-10 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-purple-500/10 rounded-full" style={{ animation: 'spin 30s linear infinite' }} />
        </div>

        {/* Header */}
        <div className="relative text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-white">Why Choose </span>
            <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Evo-TFX?</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            What makes us different from other API testing platforms
          </p>
        </div>

        {/* Creative Grid - 3 columns with staggered layout */}
        <div className="relative grid grid-cols-2 md:grid-cols-3 gap-4">
          {differentiators.map((item, index) => {
            const Icon = item.icon;
            const isMiddle = index % 3 === 1;
            return (
              <div
                key={index}
                className={`group relative ${isMiddle ? 'md:translate-y-8' : ''}`}
                style={{ animation: `fadeSlideUp 0.5s ease-out ${index * 0.1}s both` }}
              >
                {/* Card */}
                <div className="relative bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/10 group-hover:border-white/30 transition-all duration-300 group-hover:scale-105 overflow-hidden">
                  {/* Glow on hover */}
                  <div className={`absolute -inset-1 bg-gradient-to-r ${item.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500`} />

                  {/* Top accent line */}
                  <div className={`absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r ${item.gradient} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />

                  {/* Content */}
                  <div className="relative">
                    {/* Icon orb */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity`} />
                        <div className={`relative w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon size={22} className="text-white" />
                        </div>
                      </div>
                      <h3 className={`text-sm font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                        {item.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Corner decoration */}
                  <div className={`absolute bottom-2 right-2 w-8 h-8 border-r border-b ${item.gradient.includes('green') ? 'border-green-500/20' : item.gradient.includes('blue') ? 'border-blue-500/20' : item.gradient.includes('purple') ? 'border-purple-500/20' : 'border-pink-500/20'} rounded-br-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>

      {/* Testimonials - Creative Design */}
      <section id="testimonials" className="relative z-10 max-w-6xl mx-auto px-6 py-12 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 text-8xl text-white/[0.02] font-serif">"</div>
          <div className="absolute bottom-20 right-10 text-8xl text-white/[0.02] font-serif rotate-180">"</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-pink-600/5 to-orange-600/5 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <div className="relative text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4">
            <div className="flex -space-x-2">
              {['K', 'A', 'D'].map((letter, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-900"
                  style={{ animation: `popIn 0.3s ease-out ${i * 0.1}s both` }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-400 ml-2">and more professionals trust us</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-white">Loved by </span>
            <span className="bg-gradient-to-r from-pink-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">Professionals</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            See what industry experts say about Evo-TFX
          </p>
        </div>

        {/* Testimonial Cards - Creative Floating Design */}
        <div className="relative flex flex-col md:flex-row justify-center gap-6">
          {testimonials.map((testimonial, index) => {
            const gradients = [
              'from-pink-500 to-rose-600',
              'from-orange-500 to-amber-600',
              'from-purple-500 to-indigo-600'
            ];
            const isMiddle = index === 1;
            return (
              <div
                key={index}
                className={`group relative flex-1 max-w-sm ${isMiddle ? 'md:-translate-y-4' : ''}`}
                style={{ animation: `floatTestimonial 6s ease-in-out ${index * 0.5}s infinite` }}
              >
                {/* Glow effect */}
                <div className={`absolute -inset-2 bg-gradient-to-r ${gradients[index]} rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500`} />

                {/* Card */}
                <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 group-hover:border-white/30 transition-all duration-300 h-full">
                  {/* Quote mark */}
                  <div className={`absolute -top-3 -left-2 text-4xl font-serif bg-gradient-to-r ${gradients[index]} bg-clip-text text-transparent opacity-50`}>"</div>

                  {/* Stars with animation */}
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className="text-yellow-400 fill-yellow-400"
                        style={{ animation: `starPop 0.3s ease-out ${i * 0.1}s both` }}
                      />
                    ))}
                  </div>

                  {/* Quote text */}
                  <p className="text-gray-300 text-sm leading-relaxed mb-5 line-clamp-4 group-hover:line-clamp-none transition-all">
                    "{testimonial.text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    {/* Avatar with orbital ring */}
                    <div className="relative">
                      <div
                        className="absolute -inset-1 rounded-full border border-white/20"
                        style={{ animation: 'spin 10s linear infinite' }}
                      >
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradients[index]}`} />
                      </div>
                      <div className={`relative w-10 h-10 bg-gradient-to-br ${gradients[index]} rounded-full flex items-center justify-center font-bold text-white text-sm`}>
                        {testimonial.image}
                      </div>
                    </div>
                    <div>
                      <div className={`font-bold text-sm bg-gradient-to-r ${gradients[index]} bg-clip-text text-transparent`}>{testimonial.name}</div>
                      <div className="text-xs text-gray-500">{testimonial.role}</div>
                    </div>
                  </div>

                  {/* Decorative corner */}
                  <div className={`absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl ${gradients[index]} opacity-5 rounded-br-2xl rounded-tl-[100px]`} />
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes floatTestimonial {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes starPop {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
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

      {/* CTA Section - Creative Design */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" style={{ backgroundSize: '200% 200%', animation: 'gradientFlow 6s ease infinite' }} />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white/20 rounded-full"
                style={{
                  left: `${10 + i * 12}%`,
                  top: `${20 + Math.sin(i) * 30}%`,
                  animation: `ctaFloat ${4 + i}s ease-in-out infinite`
                }}
              />
            ))}
          </div>

          {/* Decorative rings */}
          <div className="absolute -right-20 -top-20 w-64 h-64 border border-white/10 rounded-full" />
          <div className="absolute -right-10 -top-10 w-48 h-48 border border-white/10 rounded-full" />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 border border-white/10 rounded-full" />

          {/* Content */}
          <div className="relative p-10 text-center">
            {/* Rocket icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-white/10 backdrop-blur-sm" style={{ animation: 'rocketBounce 2s ease-in-out infinite' }}>
              <Rocket size={32} className="text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Ready to Transform Your API Testing?
            </h2>
            <p className="text-white/80 mb-8 max-w-xl mx-auto text-sm">
              Join thousands of developers who trust Evo-TFX for their API testing needs
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => handleGetStarted('signup')}
                className="group relative px-8 py-3 bg-white text-purple-600 rounded-full font-bold hover:shadow-2xl hover:shadow-white/20 transition-all transform hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Zap size={18} />
                  Start Free Trial
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => handleGetStarted('login')}
                className="group px-8 py-3 bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-full font-bold hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Play size={18} />
                Login to Continue
              </button>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 flex items-center justify-center gap-6 text-white/60 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle size={14} />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={14} />
                <span>Free forever plan</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={14} />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes gradientFlow {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes rocketBounce {
            0%, 100% { transform: translateY(0) rotate(-10deg); }
            50% { transform: translateY(-10px) rotate(10deg); }
          }
          @keyframes ctaFloat {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
            50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
          }
        `}</style>
      </section>

      {/* Footer - Creative Compact Design */}
      <footer className="relative z-10 mt-8">
        {/* Top aurora border */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
                style={{ animation: 'logoFloat 4s ease-in-out infinite' }}
              >
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <div className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Evo-TFX</div>
                <a
                  href="https://www.evolune.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                >
                  by EvoluneEdgeTech
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
              <a href="mailto:contact@evolune.in" className="hover:text-white transition-colors">Contact</a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {[
                { icon: Github, href: 'https://github.com/EvoluneEdgeTech', gradient: 'from-gray-600 to-gray-700' },
                { icon: Twitter, href: 'https://x.com/EvoluneEdgeTech', gradient: 'from-blue-400 to-blue-600' },
                { icon: Linkedin, href: 'https://www.linkedin.com/in/evolune-edgetech-546640389/', gradient: 'from-blue-600 to-blue-800' },
                { icon: Mail, href: 'mailto:contact@evolune.in', gradient: 'from-pink-500 to-rose-600' }
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${social.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors" />
                  <social.icon size={16} className="relative z-10 text-gray-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              © 2026 Evo-TFX. All rights reserved. Built with ❤️ for developers.
            </p>
          </div>
        </div>

        <style>{`
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}</style>
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