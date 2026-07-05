import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      queryClient.setQueryData(["/api/auth/user"], data.user);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Admin Login
          </CardTitle>
          <CardDescription className="text-center">
            SecureExam Administration Portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@secureexam.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {/* Demo Credentials Box */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-info-circle text-indigo-500 text-xs"></i>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Demo Credentials
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@example.com");
                    setPassword("admin123");
                  }}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline underline-offset-2 transition-colors"
                  data-testid="button-use-demo"
                >
                  Use Demo Credentials
                </button>
              </div>
              <div className="space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16 flex-shrink-0">Email:</span>
                  <span className="bg-white dark:bg-slate-800 rounded px-2 py-0.5 border border-slate-200 dark:border-slate-700 select-all">
                    admin@example.com
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16 flex-shrink-0">Password:</span>
                  <span className="bg-white dark:bg-slate-800 rounded px-2 py-0.5 border border-slate-200 dark:border-slate-700 select-all">
                    admin123
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
