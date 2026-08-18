import { useState } from 'react';

interface Props {
  onSubmit: (url: string, username: string, password: string) => void;
  disabled: boolean;
}

export function TargetForm({ onSubmit, disabled }: Props) {
  const [url, setUrl] = useState('http://localhost:4000');
  const [username, setUsername] = useState('employee@acme.com');
  const [password, setPassword] = useState('employee123');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && username && password) {
      onSubmit(url, username, password);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Tutus</h1>
        <p className="text-gray-400 text-lg">Security Investigation Agent</p>
        <p className="text-gray-500 text-sm mt-2">
          Discover the most dangerous action an authenticated user can perform
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
            Target Application URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://app.example.com"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
            Username / Email
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="user@company.com"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
            disabled={disabled}
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-lg transition-colors mt-2"
        >
          {disabled ? 'Investigating...' : 'FIND'}
        </button>
      </form>
    </div>
  );
}
