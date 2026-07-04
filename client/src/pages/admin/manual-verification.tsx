import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";

interface ExamSession {
  id: string;
  hallTicketId: string;
  studentId: string;
  status: string;
  isVerified: boolean;
  verificationData: any;
  createdAt: string;
}

export default function ManualVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Fetch exam sessions that need manual verification
  const { data: sessions = [], isLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/exam-sessions"],
    select: (data) => data.filter((session: ExamSession) => 
      !session.isVerified && 
      session.verificationData && 
      session.verificationData.status === 'pending_manual_review'
    ),
  });

  // Approve verification mutation
  const approveVerificationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("PATCH", `/api/exam-sessions/${sessionId}`, {
        isVerified: true,
        verificationData: {
          ...selectedSession?.verificationData,
          status: 'approved',
          reviewedBy: user?.id,
          reviewedAt: new Date().toISOString()
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification Approved",
        description: "Student identity has been verified and approved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-sessions"] });
      setShowReviewModal(false);
      setSelectedSession(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject verification mutation
  const rejectVerificationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("PATCH", `/api/exam-sessions/${sessionId}`, {
        isVerified: false,
        verificationData: {
          ...selectedSession?.verificationData,
          status: 'rejected',
          reviewedBy: user?.id,
          reviewedAt: new Date().toISOString()
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification Rejected",
        description: "Student identity verification has been rejected",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-sessions"] });
      setShowReviewModal(false);
      setSelectedSession(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReview = (session: ExamSession) => {
    setSelectedSession(session);
    setShowReviewModal(true);
  };

  const handleApprove = () => {
    if (selectedSession) {
      approveVerificationMutation.mutate(selectedSession.id);
    }
  };

  const handleReject = () => {
    if (selectedSession) {
      rejectVerificationMutation.mutate(selectedSession.id);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Admin access required</p>
            <Link href="/">
              <Button className="mt-4" data-testid="button-home">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Eye className="text-primary text-3xl" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Manual Verification Review</h1>
                <p className="text-muted-foreground">Review and approve student identity verifications</p>
              </div>
            </div>
            <Link href="/admin/dashboard">
              <Button variant="outline" data-testid="button-back-dashboard">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Verifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Identity Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading verifications...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-600 mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending identity verifications to review</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-accent" data-testid={`verification-${session.id}`}>
                    <div className="flex items-start space-x-4">
                      <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                        <Eye className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {session.verificationData?.studentName || 'Unknown Student'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Roll Number: {session.verificationData?.rollNumber || 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded: {new Date(session.verificationData?.uploadedAt || session.createdAt).toLocaleString()}
                        </p>
                        <Badge variant="secondary" className="mt-2">
                          {session.verificationData?.verificationType || 'Manual Review'}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleReview(session)}
                      data-testid={`button-review-${session.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Modal */}
        {showReviewModal && selectedSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Review Identity Verification</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Student Information */}
                  <div>
                    <h3 className="font-semibold mb-2">Student Information</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Name:</span> {selectedSession.verificationData?.studentName || 'N/A'}</p>
                      <p><span className="font-medium">Roll Number:</span> {selectedSession.verificationData?.rollNumber || 'N/A'}</p>
                      <p><span className="font-medium">Uploaded:</span> {new Date(selectedSession.verificationData?.uploadedAt || selectedSession.createdAt).toLocaleString()}</p>
                      <p><span className="font-medium">Reason:</span> {selectedSession.verificationData?.reason || 'Standard verification'}</p>
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Selfie Image */}
                  {selectedSession.verificationData?.selfieImage && (
                    <div>
                      <h3 className="font-semibold mb-2">Selfie (Live Capture)</h3>
                      <img 
                        src={selectedSession.verificationData.selfieImage} 
                        alt="Student Selfie" 
                        className="w-full rounded-lg border"
                      />
                    </div>
                  )}

                  {/* ID Document Image */}
                  {selectedSession.verificationData?.documentImage && (
                    <div>
                      <h3 className="font-semibold mb-2">ID Document</h3>
                      <img 
                        src={selectedSession.verificationData.documentImage} 
                        alt="ID Document" 
                        className="w-full rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowReviewModal(false);
                      setSelectedSession(null);
                    }}
                    data-testid="button-cancel-review"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    disabled={rejectVerificationMutation.isPending}
                    data-testid="button-reject"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    onClick={handleApprove}
                    disabled={approveVerificationMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
