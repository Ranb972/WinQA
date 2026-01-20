'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  MessageSquare,
  TestTube2,
  Bug,
  Library,
  Lightbulb,
  Home,
  ChevronDown,
  Zap,
  BarChart3,
  ClipboardList,
  Plus,
  Tag,
  CheckCircle,
  CircleDot,
  Star,
  Menu,
  X,
  FlaskConical,
  Code,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  dropdown?: DropdownItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: 'Testing Labs',
    icon: <FlaskConical className="h-4 w-4" />,
    dropdown: [
      { href: '/chat-lab', label: 'Chat Testing', icon: <Zap className="h-4 w-4" /> },
      { href: '/chat-lab?mode=compare', label: 'Compare Mode', icon: <BarChart3 className="h-4 w-4" /> },
      { href: '#', label: 'Code Testing', icon: <Code className="h-4 w-4" />, disabled: true, badge: 'Soon' },
    ],
  },
  {
    label: 'Test Cases',
    icon: <TestTube2 className="h-4 w-4" />,
    dropdown: [
      { href: '/test-cases', label: 'All Tests', icon: <ClipboardList className="h-4 w-4" /> },
      { href: '/test-cases?action=new', label: 'Add New', icon: <Plus className="h-4 w-4" /> },
      { href: '/test-cases?filter=category', label: 'By Category', icon: <Tag className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Bug Log',
    icon: <Bug className="h-4 w-4" />,
    dropdown: [
      { href: '/bugs', label: 'All Bugs', icon: <Bug className="h-4 w-4" /> },
      { href: '/bugs?status=Open', label: 'Open', icon: <CircleDot className="h-4 w-4" /> },
      { href: '/bugs?status=Resolved', label: 'Resolved', icon: <CheckCircle className="h-4 w-4" /> },
      { href: '/bugs?action=new', label: 'Report New', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Prompts',
    icon: <Library className="h-4 w-4" />,
    dropdown: [
      { href: '/prompts', label: 'All Prompts', icon: <Library className="h-4 w-4" /> },
      { href: '/prompts?filter=favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
      { href: '/prompts?action=new', label: 'Add New', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Insights',
    icon: <Lightbulb className="h-4 w-4" />,
    dropdown: [
      { href: '/insights', label: 'All Insights', icon: <Lightbulb className="h-4 w-4" /> },
      { href: '/insights?action=new', label: 'Add New', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

function NavDropdown({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-violet-300 border border-violet-500/30'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        )}
      >
        {item.icon}
        <span>{item.label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute top-full left-0 mt-2 dropdown-menu z-50"
          >
            {item.dropdown?.map((dropItem) => (
              dropItem.disabled ? (
                <div
                  key={dropItem.href}
                  className="dropdown-item opacity-50 cursor-not-allowed"
                >
                  {dropItem.icon}
                  <span>{dropItem.label}</span>
                  {dropItem.badge && (
                    <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                      {dropItem.badge}
                    </span>
                  )}
                </div>
              ) : (
                <motion.div
                  key={dropItem.href}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link
                    href={dropItem.href}
                    onClick={() => setIsOpen(false)}
                    className="dropdown-item"
                  >
                    {dropItem.icon}
                    <span>{dropItem.label}</span>
                  </Link>
                </motion.div>
              )
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isItemActive = (item: NavItem) => {
    if (item.href) {
      return pathname === item.href;
    }
    if (item.dropdown) {
      return item.dropdown.some((d) => pathname === d.href.split('?')[0]);
    }
    return false;
  };

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="fixed top-4 left-4 right-4 z-50 hidden md:block">
        <div className="glass-nav rounded-2xl px-6 py-3 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold gradient-text-primary">
                WinQA
              </span>
            </Link>

            {/* Navigation Items */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = isItemActive(item);

                if (item.dropdown) {
                  return <NavDropdown key={item.label} item={item} isActive={isActive} />;
                }

                return (
                  <motion.div
                    key={item.label}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Link
                      href={item.href!}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-violet-300 border border-violet-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* User Button */}
            <div className="flex items-center gap-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'h-8 w-8 ring-2 ring-violet-500/30',
                  },
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navbar */}
      <nav className="fixed top-4 left-4 right-4 z-50 md:hidden">
        <div className="glass-nav rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold gradient-text-primary">
                WinQA
              </span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence mode="wait">
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="glass-nav rounded-2xl mt-2 p-4"
            >
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = isItemActive(item);

                if (item.dropdown) {
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <div className="pl-4 space-y-1">
                        {item.dropdown.map((dropItem) => (
                          dropItem.disabled ? (
                            <div
                              key={dropItem.href}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 opacity-50 cursor-not-allowed"
                            >
                              {dropItem.icon}
                              <span>{dropItem.label}</span>
                              {dropItem.badge && (
                                <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                                  {dropItem.badge}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Link
                              key={dropItem.href}
                              href={dropItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                                pathname === dropItem.href.split('?')[0]
                                  ? 'bg-violet-600/20 text-violet-300'
                                  : 'text-slate-300 hover:bg-white/5'
                              )}
                            >
                              {dropItem.icon}
                              <span>{dropItem.label}</span>
                            </Link>
                          )
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href!}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-violet-600/20 text-violet-300'
                        : 'text-slate-300 hover:bg-white/5'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Section in Mobile */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-3 px-3">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'h-8 w-8 ring-2 ring-violet-500/30',
                    },
                  }}
                />
                <span className="text-sm text-slate-300">Account</span>
              </div>
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
