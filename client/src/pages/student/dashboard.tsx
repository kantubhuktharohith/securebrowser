import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldAlert, LayoutDashboard, ArrowRight } from "lucide-react";

interface ExamHistoryItem {
  id: string;
  examName: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  rollNumber: string;
  hallTicketNumber: string;
}

interface StudentProfile {
  name: string;
  email: string;
  rollNumber: string;
  userId: string;
  createdAt: string;
}

interface DetailedResult {
  sessionId: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  score: number;
  totalMarks: number;
  percentage: number | null;
  breakdown: Record<string, any>;
}

export default function StudentDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Fetch Student Profile
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useQuery<StudentProfile>({
    queryKey: ["/api/student/profile"],
    retry: false,
  });

  // Fetch Exam History
  const { data: history = [], isLoading: isHistoryLoading } = useQuery<ExamHistoryItem[]>({
    queryKey: ["/api/student/exam-history"],
    retry: false,
    enabled: !profileError,
  });

  // Fetch Detailed Result when Modal is Open
  const { data: detailedResult, isLoading: isResultLoading } = useQuery<DetailedResult>({
    queryKey: ["/api/student/exam-result", selectedSessionId],
    enabled: !!selectedSessionId,
  });

  const handleViewResult = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsResultModalOpen(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // If profile failed to load with 401 (no session), show login prompt
  const isUnauthorized = profileError && (profileError as any)?.status === 401;
  const isUnauthenticated = profileError && !profile;

  if (isUnauthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 bg-white/10 backdrop-blur-xl text-white">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Session Required</h2>
              <p className="text-white/70 text-sm leading-relaxed">
                You need to verify your hall ticket first before accessing your student dashboard. Your session may have expired.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => setLocation("/student/auth")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="button-verify-hall-ticket"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Verify Hall Ticket
              </Button>
              <Button
                onClick={() => setLocation("/student/start")}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Back to Student Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Student Portal</h1>
            <p className="text-white/80">View your exams, results, and profile</p>
          </div>
          <Link href="/student/start">
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <i className="fas fa-arrow-left mr-2"></i>Back to Portal
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div>
            <Card className="shadow-xl">
              <CardHeader className="bg-muted/50 rounded-t-lg">
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-user-circle text-2xl text-primary"></i>
                  <span>Student Profile</span>
                </CardTitle>
                <CardDescription>Personal details registered in SecureExam</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {isProfileLoading ? (
                  <div className="space-y-4">
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
                    <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                  </div>
                ) : profile ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground block">Full Name</span>
                      <span className="font-semibold text-base">{profile.name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Email Address</span>
                      <span className="font-semibold text-base">{profile.email}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Roll Number</span>
                      <span className="font-semibold text-base font-mono bg-muted px-2 py-1 rounded inline-block mt-1">
                        {profile.rollNumber}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <span className="text-xs text-muted-foreground block">Registered On</span>
                      <span className="text-sm">{formatDate(profile.createdAt)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center">No student session active. Access this page through your exam verification flow.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Exam History Card */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>My Exam History</CardTitle>
                <CardDescription>Track status, grades, and review completed assessments</CardDescription>
              </CardHeader>
              <CardContent>
                {isHistoryLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading exam history...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-file-invoice text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground font-medium">No exam records found</p>
                    <p className="text-sm text-muted-foreground">Exams you take will be listed here after completion.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Exam Name</TableHead>
                          <TableHead>Submitted At</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.examName}</TableCell>
                            <TableCell>{formatDate(item.endTime)}</TableCell>
                            <TableCell>
                              {item.score !== null && item.totalMarks !== null ? (
                                <span>{item.score} / {item.totalMarks}</span>
                              ) : (
                                <span className="text-muted-foreground">Pending</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.percentage !== null ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  item.percentage >= 75 
                                    ? "bg-green-100 text-green-800" 
                                    : item.percentage >= 40 
                                    ? "bg-yellow-100 text-yellow-800" 
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {item.percentage}% ({item.percentage >= 40 ? 'Pass' : 'Fail'})
                                </span>
                              ) : (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewResult(item.id)}
                                disabled={item.status !== "completed" && item.status !== "submitted"}
                              >
                                <i className="fas fa-chart-bar mr-1.5"></i>Detailed Score
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Detailed Result Modal */}
      <Dialog open={isResultModalOpen} onOpenChange={setIsResultModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detailed Score Report</DialogTitle>
            <DialogDescription>Question-wise assessment breakdown and performance metrics</DialogDescription>
          </DialogHeader>

          {isResultLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Retrieving score report...</p>
            </div>
          ) : detailedResult ? (
            <div className="space-y-6">
              {/* Score Indicator Banner */}
              <div className="bg-primary/5 border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg text-primary">Exam Completed</h4>
                  <p className="text-xs text-muted-foreground">Finished: {formatDate(detailedResult.endTime)}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">
                    {detailedResult.score} / {detailedResult.totalMarks}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Percentage: {detailedResult.percentage}%
                  </div>
                </div>
              </div>

              {/* Question Breakdown */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm border-b pb-2">Question Breakdown</h4>
                {Object.entries(detailedResult.breakdown).map(([qId, val], index) => {
                  const isObj = val && typeof val === "object";
                  const isCorrect = isObj ? false : !!val;
                  const earned = isObj ? val.earned : (isCorrect ? 1 : 0);
                  const max = isObj ? val.max : 1;
                  const type = isObj ? val.type : "mcq";

                  return (
                    <div key={qId} className="flex items-center justify-between border-b pb-3 text-sm">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs text-muted-foreground block">Question {index + 1}</span>
                        <span className="font-medium text-foreground">
                          {type === "subjective" 
                            ? "Subjective / Essay Type Question" 
                            : type === "coding" 
                            ? "Coding Assessment" 
                            : "Objective / Multiple Choice Question"}
                        </span>
                        {isObj && val.needsReview && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-medium ml-2">
                            AI Graded
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono bg-muted px-2 py-1 rounded text-xs font-semibold">
                          {earned} / {max} Marks
                        </span>
                        <span>
                          {type === "subjective" || type === "coding" ? (
                            earned >= (max * 0.75) ? "✅ Excellent" : earned >= (max * 0.4) ? "⚡ Average" : "❌ Poor"
                          ) : (
                            isCorrect ? "✅ Correct" : "❌ Incorrect"
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Failed to load detailed report.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
