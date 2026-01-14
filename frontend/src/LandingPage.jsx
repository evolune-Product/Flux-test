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
  Clock
} from 'lucide-react';
import AuthModal from './AuthModal';
import Toast from './Toast';

const LandingPage = ({ onLoginSuccess, authError }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [toast, setToast] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Show error toast if OAuth failed
  useEffect(() => {
    if (authError) {
      setToast({
        message: authError,
        type: 'error'
      });
    }
  }, [authError]);
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
      icon: Zap,
      title: 'AI-Powered Testing',
      description: 'Generate comprehensive test suites automatically with advanced AI algorithms',
      gradient: 'from-yellow-400 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Security First',
      description: 'Built-in security testing to identify vulnerabilities before they reach production',
      gradient: 'from-blue-400 to-cyan-500'
    },
    {
      icon: Activity,
      title: 'Performance Testing',
      description: 'Load, stress, and endurance testing to ensure your API scales',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      icon: AlertTriangle,
      title: 'Chaos Engineering',
      description: 'Test system resilience with controlled failure injection',
      gradient: 'from-red-400 to-orange-500'
    },
    {
      icon: Clock,
      title: 'Smoke Testing',
      description: 'Quick health checks for critical endpoints in CI/CD pipelines',
      gradient: 'from-green-400 to-emerald-500'
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description: 'Detailed reports and metrics to track API health over time',
      gradient: 'from-indigo-400 to-purple-500'
    }
  ];

  const testingTypes = [
    {
      name: 'Functional Testing',
      icon: FileCheck,
      color: 'blue',
      description: 'Comprehensive API validation'
    },
    {
      name: 'Smoke Testing',
      icon: Zap,
      color: 'green',
      description: 'Quick critical checks'
    },
    {
      name: 'Performance Testing',
      icon: Activity,
      color: 'purple',
      description: 'Load & stress analysis'
    },
    {
      name: 'Chaos Testing',
      icon: AlertTriangle,
      color: 'orange',
      description: 'Resilience validation'
    }
  ];

  const differentiators = [
    {
      title: 'AI-First Approach',
      description: 'Unlike traditional tools, we use AI to automatically generate test cases, reducing manual effort by 90%'
    },
    {
      title: 'All-in-One Platform',
      description: 'Functional, Performance, Chaos, and Smoke testing in one unified platform - no need for multiple tools'
    },
    {
      title: 'Developer Friendly',
      description: 'Modern UI, easy integration, and comprehensive documentation. Built by developers, for developers'
    },
    {
      title: 'Cost Effective',
      description: 'Enterprise-grade features at a fraction of the cost of competitors like Postman Pro or Katalon'
    },
    {
      title: 'GitHub Integration',
      description: 'Seamlessly save and version your test results directly to GitHub repositories'
    },
    {
      title: 'Real-time Insights',
      description: 'Live test execution with detailed logs and metrics - see what\'s happening as it happens'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Lead QA Engineer',
      company: 'TechCorp',
      image: 'SC',
      text: 'Evo-TFX reduced our testing time by 80%. The AI-powered test generation is a game-changer!',
      rating: 5
    },
    {
      name: 'Michael Rodriguez',
      role: 'DevOps Manager',
      company: 'CloudScale Inc',
      image: 'MR',
      text: 'Perfect for our CI/CD pipeline. Smoke testing gives us confidence in every deployment.',
      rating: 5
    },
    {
      name: 'Emily Watson',
      role: 'CTO',
      company: 'StartupHub',
      image: 'EW',
      text: 'Finally, an affordable all-in-one testing platform that doesn\'t compromise on features.',
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
      <nav className="relative z-50 bg-slate-900/50 backdrop-blur-lg border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Evo-TFX
                </h1>
                <p className="text-xs text-gray-400">by EvoluneEdgeTech</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#why-us" className="text-gray-300 hover:text-white transition-colors">Why Us</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Testimonials</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleGetStarted('login')}
                className="px-6 py-2 text-white hover:bg-white/10 rounded-lg transition-all"
              >
                Login
              </button>
              <button
                onClick={() => handleGetStarted('signup')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all font-semibold"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-400/30 rounded-full mb-6 animate-bounce">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">AI-Powered API Testing Platform</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Test Smarter,
            </span>
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Ship Faster
            </span>
          </h1>

          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            The complete API testing platform with AI-powered test generation, performance testing,
            chaos engineering, and real-time analytics. Built for modern development teams.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
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
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Everything you need to test, monitor, and secure your APIs in one platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 hover:border-white/30 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl"
              >
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testing Types */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Complete Testing Suite
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Four specialized testing modules for comprehensive API validation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testingTypes.map((type, index) => {
            const Icon = type.icon;
            const colors = {
              blue: 'from-blue-500 to-cyan-500',
              green: 'from-green-500 to-emerald-500',
              purple: 'from-purple-500 to-pink-500',
              orange: 'from-orange-500 to-red-500'
            };
            return (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 text-center hover:border-white/30 transition-all"
              >
                <div className={`w-20 h-20 bg-gradient-to-r ${colors[type.color]} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Icon size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{type.name}</h3>
                <p className="text-sm text-gray-400">{type.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            Why Choose Evo-TFX?
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            What makes us different from other API testing platforms
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {differentiators.map((item, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10 hover:border-white/30 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
            Loved by Developers
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See what our users say about Evo-TFX
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
                  <div className="text-sm text-gray-400">{testimonial.role} at {testimonial.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl p-12 text-center">
          <h2 className="text-5xl font-bold mb-6">Ready to Transform Your API Testing?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
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
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap size={20} className="text-white" />
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

          <div className="pt-8 border-t border-white/10 text-center text-sm text-gray-400">
            <p>&copy; 2025 Evo-TFX. All rights reserved. Built with ❤️ for developers.</p>
          </div>
        </div>
      </footer>

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
