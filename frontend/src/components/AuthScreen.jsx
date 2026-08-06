import { useState } from 'react';
import ClipoMark from './ClipoMark';

const BENEFITS = [
    'Secure local workflow',
    'No setup after first sign in',
    'Your recent jobs stay on this device',
];

export default function AuthScreen({ onAuth }) {
    const [mode, setMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');

        if (mode === 'signup' && password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await onAuth({ mode, name, email, password });
        } catch (submitError) {
            setError(submitError.message || 'Could not continue.');
            setLoading(false);
        }
    };

    return <div className="auth-shell">
        <div className="auth-aura" />
        <div className="auth-frame">
            <header className="auth-brand">
                <span><ClipoMark /></span>
                <div>
                    <strong>Clipo</strong>
                    <small>Sign in to access your studio</small>
                </div>
            </header>

            <main className="auth-layout">
                <section className="auth-marketing">
                    <div className="eyebrow">Welcome back</div>
                    <h1>Login or sign up to use your clip dashboard.</h1>
                    <p>After you sign in, you can upload videos, generate clips, track processing and export results from the same workspace.</p>
                    <ul>
                        {BENEFITS.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </section>

                <section className="auth-card">
                    <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Login</button>
                        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
                    </div>

                    <form onSubmit={submit} className="auth-form">
                        {mode === 'signup' && <label>
                            <span>Full name</span>
                            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" />
                        </label>}
                        <label>
                            <span>Email</span>
                            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
                        </label>
                        <label>
                            <span>Password</span>
                            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                        </label>
                        {mode === 'signup' && <label>
                            <span>Confirm password</span>
                            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" autoComplete="new-password" />
                        </label>}

                        {error && <p className="auth-error">{error}</p>}

                        <button className="auth-submit" type="submit" disabled={loading}>
                            {loading ? 'Please wait...' : (mode === 'signup' ? 'Create account' : 'Log in')}
                        </button>
                    </form>
                </section>
            </main>
        </div>
    </div>;
}
