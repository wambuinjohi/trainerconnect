import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, XCircle, Copy } from 'lucide-react'
import { getApiUrl, getApiBaseUrl, isCapacitorApp } from '@/lib/api-config'

export default function ApiDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    const results: Record<string, any> = {}

    // 1. Check API configuration
    results.apiUrl = getApiUrl()
    results.apiBaseUrl = getApiBaseUrl()
    results.isCapacitorApp = isCapacitorApp()
    results.environment = import.meta.env.MODE

    // 2. Check localStorage
    results.storedApiUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('api_url') : 'N/A'
    results.hasAuthToken = typeof localStorage !== 'undefined' ? !!localStorage.getItem('auth_token') : false

    // 3. Test health check endpoint
    try {
      const response = await fetch(results.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'health_check' }),
      })

      results.healthCheck = {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        corsHeader: response.headers.get('access-control-allow-origin'),
      }

      const text = await response.text()
      results.healthCheck.bodyPreview = text.substring(0, 200)
      results.healthCheck.isJson = text.trim().startsWith('{')
      results.healthCheck.isHtml = text.trim().startsWith('<')

      try {
        const json = JSON.parse(text)
        results.healthCheck.parsedJson = json
        results.healthCheck.parseSuccess = true
      } catch {
        results.healthCheck.parseSuccess = false
      }
    } catch (error) {
      results.healthCheck = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // 4. Test OPTIONS preflight
    try {
      const response = await fetch(results.apiUrl, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      results.preflight = {
        status: response.status,
        statusText: response.statusText,
        corsHeaders: {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
        },
      }
    } catch (error) {
      results.preflight = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // 5. Browser info
    results.userAgent = navigator.userAgent
    results.location = {
      href: window.location.href,
      origin: window.location.origin,
      protocol: window.location.protocol,
      host: window.location.host,
    }

    setDiagnostics(results)
    setLoading(false)
  }

  const copyToClipboard = () => {
    const text = JSON.stringify(diagnostics, null, 2)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getHealthStatus = () => {
    if (!diagnostics.healthCheck) return null
    if (diagnostics.healthCheck.error) return 'error'
    if (diagnostics.healthCheck.isHtml) return 'error'
    if (!diagnostics.healthCheck.parseSuccess) return 'warning'
    if (diagnostics.healthCheck.status === 200) return 'success'
    return 'warning'
  }

  const healthStatus = getHealthStatus()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">API Diagnostics</h1>
          <p className="text-lg text-slate-600">
            Debug API connectivity and configuration issues
          </p>
        </div>

        <Button
          onClick={runDiagnostics}
          disabled={loading}
          className="mb-6"
          size="lg"
        >
          {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
        </Button>

        {Object.keys(diagnostics).length > 0 && (
          <div className="space-y-6">
            {/* Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">API URL</p>
                    <p className="text-sm text-slate-600 break-all font-mono bg-slate-50 p-2 rounded">
                      {diagnostics.apiUrl}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">API Base URL</p>
                    <p className="text-sm text-slate-600 break-all font-mono bg-slate-50 p-2 rounded">
                      {diagnostics.apiBaseUrl}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Environment</p>
                    <p className="text-sm text-slate-600 font-mono bg-slate-50 p-2 rounded">
                      {diagnostics.environment}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Capacitor App</p>
                    <p className="text-sm text-slate-600 font-mono bg-slate-50 p-2 rounded">
                      {diagnostics.isCapacitorApp ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Stored API URL</p>
                    <p className="text-sm text-slate-600 font-mono bg-slate-50 p-2 rounded break-all">
                      {diagnostics.storedApiUrl || 'Not set (using defaults)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Auth Token</p>
                    <p className="text-sm text-slate-600 font-mono bg-slate-50 p-2 rounded">
                      {diagnostics.hasAuthToken ? 'Present' : 'Not found'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Check Card */}
            {diagnostics.healthCheck && (
              <Card className={
                healthStatus === 'success'
                  ? 'border-green-200 bg-green-50'
                  : healthStatus === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
              }>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {healthStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {healthStatus === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                    {healthStatus === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                    Health Check
                  </CardTitle>
                  <CardDescription>
                    Testing connection to API endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {diagnostics.healthCheck.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Connection failed: {diagnostics.healthCheck.error}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">HTTP Status</p>
                          <p className={`text-sm font-mono p-2 rounded ${
                            diagnostics.healthCheck.status === 200 ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
                          }`}>
                            {diagnostics.healthCheck.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Content-Type</p>
                          <p className={`text-sm font-mono p-2 rounded ${
                            diagnostics.healthCheck.contentType?.includes('json')
                              ? 'bg-green-100 text-green-900'
                              : 'bg-red-100 text-red-900'
                          }`}>
                            {diagnostics.healthCheck.contentType || 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Response Type</p>
                          <p className={`text-sm font-mono p-2 rounded ${
                            diagnostics.healthCheck.isJson ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
                          }`}>
                            {diagnostics.healthCheck.isJson ? 'JSON ✓' : diagnostics.healthCheck.isHtml ? 'HTML ✗' : 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">CORS Header</p>
                          <p className="text-sm font-mono p-2 rounded bg-slate-100">
                            {diagnostics.healthCheck.corsHeader || 'Not set'}
                          </p>
                        </div>
                      </div>

                      {diagnostics.healthCheck.bodyPreview && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Response Preview</p>
                          <pre className="bg-slate-900 text-slate-50 p-4 rounded text-xs overflow-auto max-h-32">
                            {diagnostics.healthCheck.bodyPreview}
                            {diagnostics.healthCheck.bodyPreview.length >= 200 && '...'}
                          </pre>
                        </div>
                      )}

                      {diagnostics.healthCheck.isHtml && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Error:</strong> API is returning HTML instead of JSON. This usually means:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>api.php file is not executable (PHP not enabled on server)</li>
                              <li>.htaccess file is missing or misconfigured</li>
                              <li>API endpoint is returning an error page (Apache, maintenance page, etc.)</li>
                              <li>Wrong API URL configured - ensure /api.php is correct</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {diagnostics.healthCheck.parseSuccess && diagnostics.healthCheck.parsedJson && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Parsed Response</p>
                          <pre className="bg-slate-900 text-slate-50 p-4 rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(diagnostics.healthCheck.parsedJson, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* CORS Preflight Card */}
            {diagnostics.preflight && (
              <Card>
                <CardHeader>
                  <CardTitle>CORS Preflight Check</CardTitle>
                  <CardDescription>OPTIONS request for cross-origin validation</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnostics.preflight.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Preflight check failed: {diagnostics.preflight.error}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm"><strong>Status:</strong> {diagnostics.preflight.status}</p>
                      <div>
                        <p className="text-sm font-semibold mb-2">CORS Headers:</p>
                        <div className="space-y-1">
                          {Object.entries(diagnostics.preflight.corsHeaders).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-mono">{key}:</span> {String(value) || '(not set)'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Browser Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Browser & Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Current URL</p>
                  <p className="text-sm text-slate-600 break-all font-mono bg-slate-50 p-2 rounded">
                    {diagnostics.location?.href}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Origin</p>
                  <p className="text-sm text-slate-600 font-mono bg-slate-50 p-2 rounded">
                    {diagnostics.location?.origin}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">User Agent</p>
                  <p className="text-sm text-slate-600 break-all font-mono bg-slate-50 p-2 rounded">
                    {diagnostics.userAgent}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Export Card */}
            <Card>
              <CardHeader>
                <CardTitle>Export Diagnostics</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={copyToClipboard}
                  className="w-full"
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? 'Copied to clipboard!' : 'Copy Diagnostics JSON'}
                </Button>
              </CardContent>
            </Card>

            {/* Troubleshooting Guide */}
            <Card>
              <CardHeader>
                <CardTitle>Troubleshooting Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">If Health Check shows HTML response:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                    <li>Ensure PHP is enabled on your server</li>
                    <li>Verify api.php exists in your webroot</li>
                    <li>Check that .htaccess file is present and properly configured</li>
                    <li>Ensure connection.php and mpesa_helper.php are accessible</li>
                    <li>Check server error logs for PHP errors</li>
                    <li>Verify database credentials in .env file</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">If CORS headers are missing:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                    <li>Ensure mod_headers is enabled in Apache</li>
                    <li>Verify .htaccess CORS configuration is correct</li>
                    <li>Check server configuration for AllowOverride All</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">For local development:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                    <li>Ensure Vite dev server is running (npm run dev)</li>
                    <li>Check that NODE_ENV is set to development</li>
                    <li>Verify no external API URL is set in localStorage</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
