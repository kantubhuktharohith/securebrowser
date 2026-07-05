import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";
import type { SecurityIncident, ExamSession } from "@shared/schema";
import { AdminNavbar } from "@/components/admin-navbar";

interface ExamStats {
  activeStudents: number;
  totalSessions: number;
  securityAlerts: number;
  averageProgress: number;
}

interface StudentStatus {
  id: string;
  name: string;
  rollNumber: string;
  status: 'online' | 'offline' | 'warning' | 'alert';
  progress: number;
  timeRemaining: string;
  lastActivity: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [realTimeAlerts, setRealTimeAlerts] = useState<SecurityIncident[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);

  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage } = useWebSocket();

  // Fetch exam statistics
  const { data: examStats, isLoading: statsLoading } = useQuery<ExamStats>({
    queryKey: ["/api/exam-stats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch active sessions
  const { data: activeSessions = [], isLoading: sessionsLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/active-sessions"],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch recent security incidents
  const { data: securityIncidents = [], isLoading: incidentsLoading } = useQuery<SecurityIncident[]>({
    queryKey: ["/api/security-incidents"],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        if (message.type === 'security_incident') {
          setRealTimeAlerts(prev => [message.data, ...prev.slice(0, 4)]);
          toast({
            title: "Security Alert",
            description: `${message.data.studentName}: ${message.data.description}`,
            variant: "destructive",
          });
        } else if (message.type === 'student_status') {
          setStudentStatuses(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.id === message.data.studentId);
            if (index !== -1) {
              updated[index] = { ...updated[index], ...message.data };
            } else {
              updated.push(message.data);
            }
            return updated.slice(0, 8); // Keep only latest 8 students
          });
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    }
  }, [lastMessage, toast]);

  // Connect to admin WebSocket on mount
  useEffect(() => {
    if (user) {
      sendMessage({
        type: 'auth',
        userId: user.id,
        userType: 'admin'
      });
    }
  }, [user, sendMessage]);

  const formatTimeRemaining = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'warning': return 'status-warning';
      case 'alert': return 'status-danger';
      default: return 'status-offline';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'high': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'multiple_faces': return 'fa-users';
      case 'looking_away': return 'fa-eye-slash';
      case 'network_disconnect': return 'fa-wifi';
      default: return 'fa-exclamation-triangle';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 dark:text-red-400';
      case 'high': return 'text-orange-700 dark:text-orange-400';
      case 'medium': return 'text-yellow-700 dark:text-yellow-400';
      default: return 'text-blue-700 dark:text-blue-400';
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center page-enter">
        <Card className="border-0 shadow-xl animate-scale-in">
          <CardContent className="pt-8 pb-6 px-8 text-center">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-lock text-red-500 text-xl"></i>
            </div>
            <p className="text-foreground font-semibold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-5">Admin credentials required</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg btn-shine" data-testid="button-home">
                <i className="fas fa-home mr-2 text-xs"></i>
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      label: "Active Students",
      value: statsLoading ? '...' : examStats?.activeStudents || 0,
      icon: "fas fa-users",
      gradient: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
      subText: "Active now",
      subIcon: "fa-circle",
      subColor: "text-emerald-600",
      testId: "stat-active-students"
    },
    {
      label: "Security Alerts",
      value: statsLoading ? '...' : examStats?.securityAlerts || 0,
      icon: "fas fa-exclamation-triangle",
      gradient: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50 dark:bg-amber-950/30",
      subText: `${realTimeAlerts.length} recent`,
      subIcon: "fa-clock",
      subColor: "text-muted-foreground",
      testId: "stat-security-alerts"
    },
    {
      label: "Avg Progress",
      value: statsLoading ? '...' : `${examStats?.averageProgress || 0}%`,
      icon: "fas fa-chart-line",
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50 dark:bg-blue-950/30",
      progress: examStats?.averageProgress || 0,
      testId: "stat-avg-progress"
    },
    {
      label: "Total Sessions",
      value: statsLoading ? '...' : examStats?.totalSessions || 0,
      icon: "fas fa-desktop",
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 dark:bg-violet-950/30",
      subText: "All time",
      subIcon: "fa-database",
      subColor: "text-muted-foreground",
      testId: "stat-total-sessions"
    }
  ];

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Admin Header */}
      <AdminNavbar />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {statCards.map((stat, i) => (
            <Card key={i} className="card-hover border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-extrabold text-foreground mt-1" style={{ fontFamily: 'var(--font-heading)' }} data-testid={stat.testId}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`icon-container w-10 h-10 bg-gradient-to-br ${stat.gradient} text-white rounded-xl text-sm`}>
                    <i className={stat.icon}></i>
                  </div>
                </div>
                {stat.progress !== undefined ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-700" 
                        style={{ width: `${stat.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : stat.subText ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <i className={`fas ${stat.subIcon} ${stat.subColor} text-[10px]`}></i>
                    <span className={`${stat.subColor} text-xs`}>{stat.subText}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Student Monitoring */}
          <div className="lg:col-span-2">
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2.5 text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center">
                      <i className="fas fa-video text-indigo-600 text-sm"></i>
                    </div>
                    <span>Live Student Monitoring</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" className="text-xs rounded-lg" data-testid="button-filter">
                      <i className="fas fa-filter mr-1.5 text-[10px]"></i>Filter
                    </Button>
                    <Link href="/admin/monitoring">
                      <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs rounded-lg btn-shine" data-testid="button-full-view">
                        <i className="fas fa-expand mr-1.5 text-[10px]"></i>Full View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="text-center py-12">
                    <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading active sessions...</p>
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-users text-slate-400 text-2xl"></i>
                    </div>
                    <p className="text-foreground font-semibold text-sm mb-1" style={{ fontFamily: 'var(--font-heading)' }}>No Active Sessions</p>
                    <p className="text-muted-foreground text-xs">Students will appear here when they start an exam</p>
                  </div>
                ) : (
                  <div className="data-grid">
                    {activeSessions.slice(0, 6).map((session) => (
                      <div key={session.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 card-hover" data-testid={`student-card-${session.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {session.studentId?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>Student {session.studentId}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">#{session.id.slice(-6)}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <div className={`status-indicator ${getStatusColor(session.status)}`}></div>
                            <span className="text-[11px] text-muted-foreground capitalize font-medium">{session.status}</span>
                          </div>
                        </div>
                        
                        <div className="video-feed bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg mb-3" style={{ height: '110px' }}>
                          <div className="w-full h-full flex items-center justify-center text-white/50">
                            <i className="fas fa-video text-lg"></i>
                          </div>
                          <div className="video-overlay">
                            <i className="fas fa-check-circle text-emerald-400 mr-1"></i>Face: ✓
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                          <span><i className="fas fa-tasks mr-1 text-[9px]"></i>Progress: {session.currentQuestion || 1}/50</span>
                          <span><i className="fas fa-clock mr-1 text-[9px]"></i>{formatTimeRemaining(session.timeRemaining || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alert & Activity Panel */}
          <div className="space-y-5">
            {/* Recent Alerts */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2.5 text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950/30 rounded-lg flex items-center justify-center">
                    <i className="fas fa-exclamation-triangle text-amber-600 text-sm"></i>
                  </div>
                  <span>Recent Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsLoading ? (
                  <div className="text-center py-6">
                    <div className="w-8 h-8 border-[3px] border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-xs text-muted-foreground">Loading alerts...</p>
                  </div>
                ) : (realTimeAlerts.length > 0 ? realTimeAlerts : securityIncidents.slice(0, 3)).map((incident, index) => (
                  <div key={incident.id || index} className={`flex items-start space-x-3 p-3 rounded-xl mb-2.5 border-l-[3px] border transition-all duration-300 animate-fade-in ${getSeverityColor(incident.severity)}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      incident.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 
                      incident.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' : 
                      'bg-yellow-100 dark:bg-yellow-900/30'
                    }`}>
                      <i className={`fas ${getSeverityIcon(incident.incidentType)} ${getSeverityTextColor(incident.severity)} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${getSeverityTextColor(incident.severity)}`}>
                        {incident.description}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                        {incident.incidentType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {new Date(incident.createdAt || '').toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {!incidentsLoading && securityIncidents.length === 0 && realTimeAlerts.length === 0 && (
                  <div className="text-center py-6 animate-fade-in">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-shield-alt text-emerald-600 text-lg"></i>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400" style={{ fontFamily: 'var(--font-heading)' }}>All Clear</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No security alerts detected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2.5 text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg flex items-center justify-center">
                    <i className="fas fa-heartbeat text-emerald-600 text-sm"></i>
                  </div>
                  <span>System Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { label: "AI Monitoring", status: "Active", healthy: true },
                    { label: "WebSocket", status: "Connected", healthy: true },
                    { label: "Database", status: "Operational", healthy: true },
                    { label: "Storage", status: "78% Full", healthy: false }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <span className="text-sm text-foreground font-medium">{item.label}</span>
                      <div className="flex items-center space-x-2">
                        <div className={`status-indicator ${item.healthy ? 'status-online' : 'status-warning'}`}></div>
                        <span className={`text-xs font-medium ${item.healthy ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2.5 text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center">
                    <i className="fas fa-bolt text-indigo-600 text-sm"></i>
                  </div>
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  <Button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-lg shadow-md shadow-indigo-500/15 btn-shine" data-testid="button-broadcast">
                    <i className="fas fa-broadcast-tower mr-2 text-xs"></i>Send Broadcast
                  </Button>
                  <Button variant="outline" className="w-full text-amber-700 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-medium rounded-lg" data-testid="button-pause-all">
                    <i className="fas fa-pause mr-2 text-xs"></i>Pause All Exams
                  </Button>
                  <Link href="/admin/incidents">
                    <Button variant="outline" className="w-full font-medium rounded-lg" data-testid="button-incidents">
                      <i className="fas fa-shield-alt mr-2 text-xs"></i>View All Incidents
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
