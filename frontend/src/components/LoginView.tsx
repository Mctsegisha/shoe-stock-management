import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { UserSession } from '../types.ts';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
  triggerToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function LoginView({ onLoginSuccess, triggerToast }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        triggerToast(`Welcome back, ${data.data.user.name}!`, 'success');
        onLoginSuccess(data.data);
      } else {
        setError(data.error || 'Invalid credentials');
        triggerToast(data.error || 'Login failed', 'error');
      }
    } catch (err) {
      setError('Network error, please try again.');
      triggerToast('Unable to connect to login service', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-viewport" className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6 relative overflow-hidden transition-colors duration-200">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ring/5 rounded-full filter blur-3xl" />

      <motion.div 
        id="login-card-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl relative z-10 transition-colors duration-200"
      >
        {/* Header branding */}
        <div className="text-center mb-8">
          <motion.div 
            id="brand-icon-wrapper"
            className="w-12 h-12 bg-accent border border-border text-accent-foreground rounded-2xl flex items-center justify-center font-black text-2xl mx-auto shadow-inner mb-4 transition-colors duration-200"
            whileHover={{ scale: 1.1, rotate: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            👟
          </motion.div>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-none mb-1 transition-colors duration-200">ShoeTracker</h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase transition-colors duration-200">Enterprise Stock Platform</p>
        </div>

        {/* Form area */}
        <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div 
              id="login-error-alert"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold p-3.5 rounded-xl flex items-center space-x-2.5"
            >
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </motion.div>
          )}

          <div>
            <label className="block text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 ml-1 transition-colors duration-200">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground/70" />
              <input 
                id="login-email-input"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-background border border-border rounded-xl py-3 pl-11 pr-4 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 ml-1 transition-colors duration-200">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground/70" />
              <input 
                id="login-password-input"
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-background border border-border rounded-xl py-3 pl-11 pr-11 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer focus:outline-none"
                disabled={loading}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <button 
            id="login-submit-button"
            type="submit"
            className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            disabled={loading}
          >
            {loading ? (
              <span className="border-2 border-white/30 border-t-white w-4 h-4 rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
