import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  return (
    <div className="cs-login-wrap">
      <form className="cs-login-card" onSubmit={submit}>
        <h1>HOWTOM 콘텐츠 제작소</h1>
        <p>유니버스와 같은 관리자 계정으로 로그인합니다.</p>
        {error && <div className="cs-error">{error}</div>}
        <label>이메일<input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label>
        <label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} required/></label>
        <button className="cs-btn cs-btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
      </form>
    </div>
  );
}
