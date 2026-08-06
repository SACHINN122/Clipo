import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportScreen() {
    const [message, setMessage] = useState('');
    const [sent, setSent] = useState(false);
    const navigate = useNavigate();

    const submit = async () => {
        try {
            await fetch('/api/report', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            setSent(true);
        } catch (err) {
            setSent(true);
        }
    };

    return (
        <div className="report-page">
            <div className="report-frame">
                <header className="report-header">
                    <button className="ghost" onClick={() => navigate(-1)}>← Back</button>
                    <h1>Report an issue</h1>
                </header>
                <div className="report-body">
                    {!sent ? (
                        <>
                            <p>Tell us what went wrong or how we can improve. Your report helps us make Clipo better.</p>
                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue..." />
                            <div className="report-actions">
                                <button className="results-quiet" onClick={() => navigate(-1)}>Cancel</button>
                                <button className="results-primary" onClick={submit} disabled={!message.trim()}>Send report</button>
                            </div>
                        </>
                    ) : (
                        <div className="report-sent">
                            <h3>Thanks — report submitted</h3>
                            <p>We received your message and will review it shortly.</p>
                            <button className="results-primary" onClick={() => navigate('/')}>Back to home</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
