import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Award, Clock, CheckCircle, FileText } from "lucide-react";
import { Link } from "wouter";
import { generateExamReport } from "@/lib/exam-utils";
import type { ExamSession, Question } from "@shared/schema";
import jsPDF from "jspdf";
import { AdminNavbar } from "@/components/admin-navbar";

export default function Results() {
  const { user } = useAuth();

  // Fetch completed exam sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/exam-sessions"],
  });

  // Fetch all questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">Access denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSessions = sessions.filter((session: any) => session.status === "completed");

  const getResultsForSession = (session: any) => {
    // Filter questions to only include those that were part of this exam session
    const sessionQuestionIds = Array.isArray(session.questionIds) ? session.questionIds : [];
    const sessionQuestions = (questions as any[])
      .filter(q => sessionQuestionIds.includes(q.id))
      .map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : []
      })) as Question[];
    
    return generateExamReport(session as any, sessionQuestions as any);
  };

  const exportResultsPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Add header with logo/title
    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SecureExam - Results Report', pageWidth / 2, 25, { align: 'center' });
    
    // Reset text color
    pdf.setTextColor(0, 0, 0);
    yPosition = 50;

    // Add summary statistics
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary Statistics', 15, yPosition);
    yPosition += 10;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Completed Exams: ${completedSessions.length}`, 15, yPosition);
    yPosition += 7;
    pdf.text(`Average Score: ${averageScore}%`, 15, yPosition);
    yPosition += 7;
    pdf.text(`Total Students: ${new Set(completedSessions.map((s: any) => s.studentId)).size}`, 15, yPosition);
    yPosition += 7;
    pdf.text(`Report Generated: ${new Date().toLocaleString()}`, 15, yPosition);
    yPosition += 15;

    // Add table header
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, yPosition, pageWidth - 30, 10, 'F');
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const columns = [
      { text: 'Student', x: 20 },
      { text: 'Hall Ticket', x: 70 },
      { text: 'Exam', x: 110 },
      { text: 'Score', x: 155 },
      { text: 'Status', x: 180 }
    ];
    
    columns.forEach(col => {
      pdf.text(col.text, col.x, yPosition + 7);
    });
    
    yPosition += 12;

    // Add student results
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    completedSessions.forEach((session: any, index: number) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      const results = getResultsForSession(session);
      const studentName = `${session.studentName || ''} ${session.studentLastName || ''}`.trim() || session.studentId;
      
      // Alternate row colors
      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
      }

      pdf.text(studentName.substring(0, 20), 20, yPosition);
      pdf.text(session.hallTicketNumber || 'N/A', 70, yPosition);
      pdf.text((session.examName || 'Exam').substring(0, 18), 110, yPosition);
      
      // Color-coded score
      if (results.score >= 80) {
        pdf.setTextColor(34, 139, 34); // Green
      } else if (results.score >= 60) {
        pdf.setTextColor(255, 165, 0); // Orange
      } else {
        pdf.setTextColor(220, 53, 69); // Red
      }
      pdf.text(`${results.score}%`, 155, yPosition);
      pdf.setTextColor(0, 0, 0); // Reset to black
      
      pdf.text('Completed', 180, yPosition);
      yPosition += 10;
    });

    // Add footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text('Generated by SecureExam Platform', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    pdf.save(`exam-results-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportResults = () => {
    const csvContent = [
      ["Student ID", "Exam Name", "Score", "Correct Answers", "Total Questions", "Time Spent (minutes)", "Status"].join(","),
      ...completedSessions.map((session: any) => {
        const results = getResultsForSession(session);
        return [
          `${session.studentName || ''} ${session.studentLastName || ''}`.trim() || session.studentId,
          session.examName || "Exam",
          `${results.score}%`,
          results.correctAnswers,
          results.totalQuestions,
          Math.round(results.timeSpent / 60000),
          session.status
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (sessionsLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading results...</p>
        </div>
      </div>
    );
  }

  const averageScore = completedSessions.length > 0 
    ? Math.round(completedSessions.reduce((sum: number, session: any) => {
        const results = getResultsForSession(session);
        return sum + results.score;
      }, 0) / completedSessions.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      <AdminNavbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Export Buttons */}
        {completedSessions.length > 0 && (
          <div className="flex gap-2 mb-6">
            <Button onClick={exportResultsPDF} className="bg-red-600 hover:bg-red-700" data-testid="button-export-pdf">
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={exportResults} variant="outline" data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Exams</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">
                {completedSessions.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-average-score">
                {averageScore}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="text-total-students">
                {new Set(completedSessions.map((s: any) => s.studentId)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results List */}
        <Card>
          <CardHeader>
            <CardTitle>Student Results</CardTitle>
          </CardHeader>
          <CardContent>
            {completedSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">No completed exams yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedSessions.map((session: any) => {
                  const results = getResultsForSession(session);
                  const getScoreColor = (score: number) => {
                    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
                    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
                    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
                  };

                  return (
                    <div key={session.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white" data-testid={`text-student-${session.studentId}`}>
                              {session.studentName} {session.studentLastName || ''} 
                              {!session.studentName && `Student ID: ${session.studentId}`}
                            </h3>
                            <Badge variant="outline">
                              {session.examName || 'Exam Session'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <div>
                              <span className="font-medium">Hall Ticket:</span>
                              <span className="ml-1" data-testid={`text-hall-ticket-${session.studentId}`}>
                                {session.hallTicketNumber || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Score:</span>
                              <Badge className={getScoreColor(results.score)} data-testid={`text-score-${session.studentId}`}>
                                {results.score}%
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Correct:</span>
                              <span className="ml-1">{results.correctAnswers}/{results.totalQuestions}</span>
                            </div>
                            <div>
                              <span className="font-medium">Time:</span>
                              <span className="ml-1">{Math.round(results.timeSpent / 60000)}m</span>
                            </div>
                            <div>
                              <span className="font-medium">Completed:</span>
                              <span className="ml-1">{session.endTime ? new Date(session.endTime).toLocaleDateString() : "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}