import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      navigate('/upload');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Login failed';
      const details = err?.response?.data?.details;
      setError(details ? `${msg}: ${details}` : msg);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Welcome back</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn btn-primary w-full" type="submit">Log in</button>
      </form>
      <p className="text-sm mt-4">No account? <Link className="text-primary-500" to="/signup">Sign up</Link></p>
    </div>
  );
}


