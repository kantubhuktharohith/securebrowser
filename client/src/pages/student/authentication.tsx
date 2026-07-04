import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QRScanner from "@/components/qr-scanner";
import { useLocation } from "wouter";

export default function StudentAuthentication() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scanMode, setScanMode] = useState(true);
  const [manualData, setManualData] = useState({
    hallTicketId: "",
    rollNumber: "",
  });

  // Verify hall ticket mutation
  const verifyHallTicketMutation = useMutation({
    mutationFn: async (data: { qrData?: string; rollNumber: string; hallTicketId?: string }) => {
      const response = await apiRequest("POST", "/api/auth/verify-hall-ticket", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: "Hall ticket verified successfully",
      });
      // Store hall ticket data and bypass subsequent scan/webcam verification pages
      localStorage.setItem("hallTicketData", JSON.stringify(result.hallTicket));
      localStorage.setItem("verificationComplete", "true");
      setLocation("/student/exam");
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQRScan = (qrData: string) => {
    try {
      const parsed = JSON.parse(qrData);
      verifyHallTicketMutation.mutate({
        qrData,
        rollNumber: parsed.rollNumber,
      });
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "Please scan a valid hall ticket QR code",
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualData.hallTicketId || !manualData.rollNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // For manual entry, send hall ticket ID and roll number directly
    verifyHallTicketMutation.mutate({
      rollNumber: manualData.rollNumber,
      hallTicketId: manualData.hallTicketId,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-orbs" style={{ background: 'linear-gradient(135deg, hsl(230, 30%, 97%) 0%, hsl(250, 25%, 95%) 50%, hsl(270, 25%, 97%) 100%)' }}>
      <Card className="max-w-md w-full shadow-2xl shadow-indigo-500/8 border-0 bg-white/80 backdrop-blur-xl animate-scale-in relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <i className="fas fa-user-graduate text-2xl text-white"></i>
          </div>
          <CardTitle className="text-2xl font-extrabold gradient-text" style={{ fontFamily: 'var(--font-heading)' }}>Student Authentication</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            {scanMode ? "Scan your hall ticket QR code to proceed" : "Enter your hall ticket details manually"}
          </p>
        </CardHeader>

        <CardContent className="space-y-5 px-7 pb-7">
          {/* Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                scanMode 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setScanMode(true)}
              data-testid="button-scan-mode"
            >
              <i className="fas fa-qrcode mr-2 text-xs"></i>QR Scan
            </button>
            <button
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                !scanMode 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setScanMode(false)}
              data-testid="button-manual-mode"
            >
              <i className="fas fa-keyboard mr-2 text-xs"></i>Manual Entry
            </button>
          </div>

          {scanMode ? (
            /* QR Scanner Section */
            <div className="space-y-4 animate-fade-in">
              <QRScanner onScan={handleQRScan} />
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Click "Start QR Scanner" below, then hold your hall ticket QR code in front of the camera
                </p>
              </div>
            </div>
          ) : (
            /* Manual Entry Form */
            <form onSubmit={handleManualSubmit} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="hallTicketId" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hall Ticket ID</Label>
                <div className="relative">
                  <i className="fas fa-ticket-alt absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <Input
                    id="hallTicketId"
                    placeholder="HT2024CS001234"
                    value={manualData.hallTicketId}
                    onChange={(e) => setManualData(prev => ({ ...prev, hallTicketId: e.target.value.toUpperCase() }))}
                    required
                    className="pl-10 h-11 bg-slate-50/80 border-slate-200 rounded-xl focus:bg-white transition-all duration-300"
                    data-testid="input-hall-ticket-id"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Roll Number</Label>
                <div className="relative">
                  <i className="fas fa-id-badge absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <Input
                    id="rollNumber"
                    placeholder="CS21B1234"
                    value={manualData.rollNumber}
                    onChange={(e) => setManualData(prev => ({ ...prev, rollNumber: e.target.value.toUpperCase() }))}
                    required
                    className="pl-10 h-11 bg-slate-50/80 border-slate-200 rounded-xl focus:bg-white transition-all duration-300"
                    data-testid="input-roll-number"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 btn-shine"
                disabled={verifyHallTicketMutation.isPending}
                data-testid="button-verify"
              >
                {verifyHallTicketMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-arrow-right text-sm"></i>
                    Proceed to Verification
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Status Display */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className={`status-indicator ${
                verifyHallTicketMutation.isPending ? 'status-warning' : 'status-offline'
              }`}></div>
              <span className="text-sm text-muted-foreground font-medium">
                {verifyHallTicketMutation.isPending 
                  ? 'Verifying hall ticket...' 
                  : 'Waiting for hall ticket scan...'
                }
              </span>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              <i className="fas fa-headset mr-1.5 text-[10px]"></i>
              Need help? Contact your exam coordinator or IT support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
