export function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isReplit = host.includes('replit') || host.includes('pike') || host.includes('repl.co');
    if (!isLocal && !isReplit) {
      return 'https://mindtrap-api.onrender.com';
    }
  }
  return '';
}
