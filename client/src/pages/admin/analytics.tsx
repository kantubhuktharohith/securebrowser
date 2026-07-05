import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";
import { AdminNavbar } from "@/components/admin-navbar";

interface ExamSession {
  id: string;
  examName: string;
  status: string;
  score: number | null;
  totalMarks: number | null;
  studentName: string | null;
  studentEmail: string | null;
  rollNumber: string | null;
  answers: any;
}

interface SecurityIncident {
  id: string;
  sessionId: string;
  incidentType: string;
  severity: string;
  description: string;
  createdAt: string;
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminAnalytics() {
  const { toast } = useToast();

  // Fetch all exam sessions
  const { data: sessions = [], isLoading: isSessionsLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/exam-sessions"],
  });

  // Fetch all security incidents
  const { data: incidents = [], isLoading: isIncidentsLoading } = useQuery<SecurityIncident[]>({
    queryKey: ["/api/security-incidents"],
  });

  // 1. Process Exam Performance metrics
  const getExamPerformanceData = () => {
    const examGroups: Record<string, { totalScores: number; totalMarks: number; count: number; name: string }> = {};

    sessions.forEach((session) => {
      if (session.status !== "completed" && session.status !== "submitted") return;
      if (session.score === null || session.totalMarks === null) return;

      const key = session.examName;
      if (!examGroups[key]) {
        examGroups[key] = { totalScores: 0, totalMarks: 0, count: 0, name: key };
      }
      examGroups[key].totalScores += session.score;
      examGroups[key].totalMarks += session.totalMarks;
      examGroups[key].count += 1;
    });

    return Object.values(examGroups).map((g) => ({
      name: g.name,
      students: g.count,
      avgScore: Math.round((g.totalScores / g.count) * 10) / 10,
      maxMarks: Math.round((g.totalMarks / g.count) * 10) / 10,
      avgPercentage: g.totalMarks > 0 ? Math.round((g.totalScores / g.totalMarks) * 100) : 0,
    }));
  };

  // 2. Process Security Incident distribution
  const getIncidentDistributionData = () => {
    const counts: Record<string, number> = {};
    
    incidents.forEach((incident) => {
      const type = incident.incidentType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  // 3. Process Question success rates
  const getQuestionSuccessRates = () => {
    const stats: Record<string, { correct: number; total: number }> = {};

    sessions.forEach((session) => {
      if (!session.answers || !session.answers.__grading) return;
      const breakdown = session.answers.__grading.breakdown || {};

      Object.entries(breakdown).forEach(([qId, result]) => {
        if (!stats[qId]) {
          stats[qId] = { correct: 0, total: 0 };
        }
        
        stats[qId].total += 1;
        
        if (result && typeof result === "object") {
          // Subjective or coding question
          const resObj = result as any;
          const earned = resObj.earned || 0;
          const max = resObj.max || 1;
          if (earned >= (max * 0.5)) { // 50% or above is considered successful
            stats[qId].correct += 1;
          }
        } else if (result === true) {
          // MCQ / TrueFalse / ShortAnswer correct
          stats[qId].correct += 1;
        }
      });
    });

    return Object.entries(stats).map(([qId, val], idx) => ({
      name: `Q${idx + 1}`,
      successRate: val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0,
      totalAttempts: val.total,
    }));
  };

  // 4. Process Incident volume timeline
  const getIncidentTimelineData = () => {
    const hourCounts: Record<string, number> = {};

    incidents.forEach((incident) => {
      const date = new Date(incident.createdAt);
      // Group by hour
      const key = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      hourCounts[key] = (hourCounts[key] || 0) + 1;
    });

    return Object.entries(hourCounts).map(([time, count]) => ({
      time,
      Incidents: count,
    })).sort((a, b) => a.time.localeCompare(b.time));
  };

  const examData = getExamPerformanceData();
  const incidentData = getIncidentDistributionData();
  const questionData = getQuestionSuccessRates().slice(0, 10); // top 10 questions
  const timelineData = getIncidentTimelineData();

  const totalFlaggedStudents = sessions.filter(
    (s) => incidents.some((i) => i.sessionId === s.id && i.severity === "critical")
  ).length;

  return (
    <div className="min-h-screen bg-gradient-primary">
      <AdminNavbar />
      <div className="container mx-auto py-8 px-4">

        {/* Aggregated Counters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Total Completed Sessions</CardDescription>
              <CardTitle className="text-3xl">{sessions.filter(s => s.status === 'completed' || s.status === 'submitted').length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Total Proctored Incidents</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{incidents.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Average Passing Rate</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {examData.length > 0 
                  ? `${Math.round(examData.reduce((sum, d) => sum + d.avgPercentage, 0) / examData.length)}%` 
                  : "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Critical Threat Index</CardDescription>
              <CardTitle className="text-3xl text-red-600">{totalFlaggedStudents} students</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Exam Average Scores Chart */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Exam Difficulty Analysis</CardTitle>
              <CardDescription>Average percentage score attained by student groups per exam module</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isSessionsLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : examData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  No completed exam data available to compile.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={examData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Avg % Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgPercentage" name="Average % Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Incident Breakdown Pie Chart */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Cheating Incident Distribution</CardTitle>
              <CardDescription>Anomalies and proctoring warnings flagged during exam runtimes</CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              {isIncidentsLoading ? (
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
              ) : incidentData.length === 0 ? (
                <div className="text-muted-foreground text-sm">No recorded proctoring incidents.</div>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row items-center justify-between">
                  <div className="w-full md:w-2/3 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incidentData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {incidentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs space-y-1 w-full md:w-1/3">
                    {incidentData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-semibold">{entry.value}</span>
                        <span className="text-muted-foreground truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question Wise Performance Chart */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Question-Wise Success Rates</CardTitle>
              <CardDescription>Visualizing student passing percentages for first 10 exam questions</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isSessionsLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : questionData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Grading records empty. Add questions to examine success metrics.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={questionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Passing Rate %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="successRate" name="Success Rate %" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Incident Timeline Volume Area Chart */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Cheating Pattern Detection / Timeline</CardTitle>
              <CardDescription>Incident frequency volume timeline recorded over active exam intervals</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isIncidentsLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : timelineData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Timeline empty. Cheating logs compile dynamically during exams.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="Incidents" stroke="#ef4444" fill="#fca5a5" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
