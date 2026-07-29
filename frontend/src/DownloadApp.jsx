import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Apple,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Cpu,
  Download,
  FileText,
  FolderKanban,
  HardDrive,
  Home,
  Lock,
  Monitor,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Zap,
} from "lucide-react";
import { FaApple } from 'react-icons/fa';

const platformCards = [
  {
    title: "Windows",
    icon: Monitor,
    accent: "from-cyan-400/25 to-sky-500/25",
    description: "Fast native app with secure installers and seamless updates.",
    installer: "Installer • .exe",
    version: "v2.4.1",
    href: "/coming-soon.html",
    size: "md:col-span-1",
  },
  {
    title: "macOS",
    icon: FaApple,
    accent: "from-violet-400/25 to-fuchsia-500/25",
    description: "Optimized for Intel and Apple Silicon with a refined feel.",
    installer: "Disk image • .dmg",
    version: "v2.4.1",
    href: "/coming-soon.html",
    size: "md:col-span-1 md:-translate-y-4",
  },
  {
    title: "Linux",
    icon: HardDrive,
    accent: "from-emerald-400/20 to-cyan-500/20",
    description: "Portable build for Ubuntu, Debian and Fedora workstations.",
    installer: "AppImage • .AppImage",
    version: "v2.4.1",
    href: "/coming-soon.html",
    size: "md:col-span-1",
  },
];

const floatingWidgets = [
  {
    icon: Cpu,
    label: "CPU",
    value: "14%",
    note: "Idle",
    className: "left-[-1.5rem] top-10 rotate-[-8deg]",
  },
  {
    icon: Sparkles,
    label: "AI Ready",
    value: "Instant",
    note: "Ready",
    className: "right-[-1rem] top-16 rotate-[7deg]",
  },
  {
    icon: Lock,
    label: "Encrypted",
    value: "AES-256",
    note: "Protected",
    className: "left-8 bottom-16 rotate-[-6deg]",
  },
  {
    icon: Cloud,
    label: "Cloud Sync",
    value: "Live",
    note: "Synced",
    className: "right-10 bottom-16 rotate-[5deg]",
  },
  {
    icon: Zap,
    label: "Auto Update",
    value: "24/7",
    note: "Fresh",
    className: "left-1/2 top-[-1rem] -translate-x-1/2 rotate-[2deg]",
  },
  {
    icon: ShieldCheck,
    label: "Crash Free",
    value: "99.98%",
    note: "Reliable",
    className: "right-0 bottom-[-1rem] rotate-[-4deg]",
  },
];

const stats = [
  { value: "12M+", label: "Downloads" },
  { value: "99.98%", label: "Crash free" },
  { value: "24/7", label: "Updates" },
];

function DownloadApp() {
  const [glow, setGlow] = useState({ x: "50%", y: "50%" });

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setGlow({
          x: `${((event.clientX - rect.left) / rect.width) * 100}%`,
          y: `${((event.clientY - rect.top) / rect.height) * 100}%`,
        });
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,50%),rgba(56,189,248,0.16),transparent_34%)]"
          style={{ ["--x"]: glow.x, ["--y"]: glow.y }}
        />
        <motion.div
          className="absolute left-[-10%] top-[-14%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/18 blur-[140px]"
          animate={{ x: [0, 28, -12, 0], y: [0, -26, 18, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[-12%] top-[10%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/15 blur-[150px]"
          animate={{ x: [0, -20, 18, 0], y: [0, 30, -14, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-8%] left-1/2 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-indigo-500/14 blur-[140px]"
          animate={{ x: [-8, 16, -10, -8], y: [0, -20, 12, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:70px_70px]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,7,18,0.7)_70%,rgba(3,7,18,0.95)_100%)]" />
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"%3E%3Cfilter id="n"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23n)" opacity="0.2"/%3E%3C/svg%3E\')',
          }}
        />
      </div>

      <nav className="relative z-20 border-b border-white/10 bg-slate-950/25 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            <Home size={16} />
            Back to Home
          </a>
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(14,165,233,0.15)] backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-cyan-500/10"
          >
            Open Flasqo
          </a>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 pb-16 pt-10 lg:px-10 lg:pt-16">
        <section className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-8">
          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, filter: "blur(10px)", y: 24 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 backdrop-blur-xl">
              <Download size={15} />
              Desktop Downloads
            </div>

            <h1 className="mt-8 text-5xl font-semibold tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl">
              Native desktop.
              <br />
              Built for speed.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400 sm:text-xl">
              A premium desktop experience for creators, operators and product
              teams who move at high velocity.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <motion.a
                href="/coming-soon.html"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-cyan-400 via-sky-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.25)]"
              >
                Download for Windows
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </motion.a>
              <motion.a
                href="/coming-soon.html"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur-xl"
              >
                <Play size={15} />
                View Releases
              </motion.a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-sm text-slate-400">
              {["Windows", "macOS", "Linux"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-xl"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="relative mx-auto w-full max-w-[560px]"
            initial={{ opacity: 0, filter: "blur(12px)", y: 24 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="relative"
              animate={{ y: [0, -8, 0], rotate: [0, -0.5, 0] }}
              transition={{
                duration: 6.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="absolute inset-0 rounded-[2rem] bg-linear-to-br from-cyan-400/20 via-sky-500/15 to-violet-500/20 blur-[70px]" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-3 shadow-[0_30px_120px_rgba(2,6,23,0.75)] backdrop-blur-2xl">
                <div className="rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950/95 p-4">
                  <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Search size={14} />
                      flasqo.app/workspace
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Bot size={16} className="text-cyan-300" />
                        AI Workspace
                      </div>
                      <div className="mt-6 space-y-3">
                        {[
                          { label: "Projects", icon: FolderKanban },
                          { label: "Search", icon: Search },
                          { label: "Automation", icon: Zap },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.label}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300"
                            >
                              <Icon size={14} className="text-slate-400" />
                              {item.label}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
                        <div className="flex items-center justify-between text-sm text-cyan-100">
                          <span>Recent Files</span>
                          <ChevronRight size={14} />
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-2.5 py-2">
                            <FileText size={14} className="text-slate-400" />
                            Launch brief
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-2.5 py-2">
                            <FileText size={14} className="text-slate-400" />
                            Product notes
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/10 bg-slate-900/60 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                        <span>Workspace</span>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                          Live
                        </span>
                      </div>
                      <div className="mt-4 rounded-[1.25rem] border border-cyan-400/20 bg-linear-to-br from-cyan-500/12 via-slate-900/70 to-violet-500/10 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">
                              Automation flow
                            </p>
                            <p className="mt-1 text-xl font-semibold text-white">
                              Ready to ship
                            </p>
                          </div>
                          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-2">
                            <Sparkles size={18} className="text-cyan-300" />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-slate-300">
                          {[
                            "Agent runs in 0.8s",
                            "Encrypted by default",
                            "Offline ready",
                          ].map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 rounded-xl bg-slate-900/50 px-3 py-2"
                            >
                              <CheckCircle2
                                size={14}
                                className="text-cyan-300"
                              />
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Latency
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            93ms
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Sync
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            Every 5s
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {floatingWidgets.map((widget, index) => {
              const Icon = widget.icon;
              return (
                <motion.div
                  key={widget.label}
                  className={`absolute hidden w-36 rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-left shadow-[0_16px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:block ${widget.className}`}
                  animate={{ y: [0, -10, 0], rotate: [0, 0.4, 0] }}
                  transition={{
                    duration: 4.2 + index * 0.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    <Icon size={12} className="text-cyan-300" />
                    {widget.label}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {widget.value}
                  </p>
                  <p className="text-sm text-slate-400">{widget.note}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section className="mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.32em] text-slate-500">
                Downloads
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Pick your platform.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-400">
              Every build is crafted to feel native, fast and dependable from
              the first launch.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {platformCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.a
                  key={card.title}
                  href={card.href}
                  whileHover={{
                    y: -6,
                    rotate: index === 1 ? -0.7 : 0.4,
                    scale: 1.01,
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-900/55 p-7 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl ${card.size}`}
                >
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${card.accent} opacity-0 transition duration-500 group-hover:opacity-100`}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)] opacity-70" />
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200">
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-white">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {card.description}
                    </p>

                    <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
                      <span>{card.installer}</span>
                      <span className="text-slate-500">{card.version}</span>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Signed & verified
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
                        Download
                        <ArrowRight
                          size={15}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </span>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </section>

        <section className="mt-20 flex flex-wrap justify-center gap-5 rounded-[2rem] border border-white/10 bg-slate-900/35 px-6 py-8 shadow-[0_18px_70px_rgba(2,6,23,0.35)] backdrop-blur-2xl sm:px-10">
          {stats.map((item) => (
            <motion.div
              key={item.label}
              className="min-w-[140px] text-center"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                {item.value}
              </p>
              <p className="mt-2 text-sm uppercase tracking-[0.28em] text-slate-500">
                {item.label}
              </p>
            </motion.div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default DownloadApp;
