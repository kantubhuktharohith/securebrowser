import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";
import { Scan, Camera, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function IdCardScan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hallTicketData, setHallTicketData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Load hall ticket data from localStorage
    const data = localStorage.getItem("hallTicketData");
    if (!data) {
      toast({
        title: "Error",
        description: "Hall ticket data not found. Please scan QR code first.",
        variant: "destructive",
      });
      setLocation("/student/auth");
      return;
    }
    
    const hallTicket = JSON.parse(data);
    setHallTicketData(hallTicket);
  }, [toast, setLocation]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          } catch (err) {
            console.error("Cleanup error:", err);
          }
        }
      };
      cleanup();
    };
  }, []);

  // Initialize scanner when scannerActive becomes true
  useEffect(() => {
    if (!scannerActive) return;

    const initScanner = async () => {
      try {
        setScanning(true);
        
        // Stop any existing scanner first
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          } catch (err) {
            console.error("Error stopping previous scanner:", err);
          }
          scannerRef.current = null;
        }
        
        // Create a new scanner instance
        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        
        // Get available cameras first
        const devices = await Html5Qrcode.getCameras();
        console.log("Available cameras:", devices);
        
        if (devices && devices.length === 0) {
          throw new Error("No cameras found on this device");
        }
        
        // Use the rear camera if available, otherwise use first camera
        const cameraId = devices.find(d => d.label.toLowerCase().includes('back'))?.id || devices[0].id;
        
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          async (decodedText) => {
            // Stop scanning on successful read
            if (scannerRef.current) {
              try {
                await scannerRef.current.stop();
                await scannerRef.current.clear();
              } catch (err) {
                console.error("Error stopping scanner after scan:", err);
              }
              scannerRef.current = null;
            }
            setScanning(false);
            setScannerActive(false);
            
            // Verify barcode
            verifyBarcode(decodedText);
          },
          (errorMessage) => {
            // Ignore scanning errors (they happen frequently during scanning)
            console.debug("Scan error:", errorMessage);
          }
        );
      } catch (error: any) {
        console.error("Scanner error:", error);
        const errorMsg = error?.message || "Could not access camera";
        toast({
          title: "Scanner Error",
          description: `${errorMsg}. Please use manual entry or check camera permissions.`,
          variant: "destructive",
        });
        setScanning(false);
        setScannerActive(false);
        scannerRef.current = null;
      }
    };

    initScanner();
  }, [scannerActive, toast]);

  const startScanning = () => {
    setVerificationStatus("idle");
    setScannerActive(true);
  };

  const stopScanning = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
    setScanning(false);
    setScannerActive(false);
  };

  const verifyBarcode = (barcode: string) => {
    setScannedBarcode(barcode);
    
    console.log('Verifying barcode:', {
      scanned: barcode,
      expected: hallTicketData?.studentIdBarcode,
      hallTicketData: hallTicketData
    });
    
    // Check if barcode matches hall ticket barcode
    if (hallTicketData && hallTicketData.studentIdBarcode === barcode) {
      setVerificationStatus("success");
      toast({
        title: "ID Card Verified",
        description: "Your ID card has been verified successfully!",
      });
      
      // Store verification status
      localStorage.setItem("idCardVerified", "true");
      
      // Navigate to identity verification after 2 seconds
      setTimeout(() => {
        setLocation("/student/identity-verification");
      }, 2000);
    } else {
      setVerificationStatus("error");
      toast({
        title: "Verification Failed",
        description: `ID card barcode does not match. Scanned: ${barcode}, Expected: ${hallTicketData?.studentIdBarcode || 'Not set'}`,
        variant: "destructive",
      });
    }
  };

  const handleManualVerify = () => {
    if (!manualBarcode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a barcode.",
        variant: "destructive",
      });
      return;
    }
    verifyBarcode(manualBarcode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Scan className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ID Card Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Scan your student ID card barcode to verify your identity
          </p>
        </div>

        {/* Student Info */}
        {hallTicketData && (
          <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm">
            <h2 className="font-semibold text-lg mb-4">Student Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{hallTicketData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Roll Number:</span>
                <span className="font-medium">{hallTicketData.rollNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exam:</span>
                <span className="font-medium">{hallTicketData.examName}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Scanner Section */}
        <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm">
          <h2 className="font-semibold text-lg mb-4">Scan ID Card Barcode</h2>
          
          {/* Scanner Display */}
          <div className="mb-6 relative">
            {/* Always render the scanner container for Html5Qrcode */}
            <div 
              id="barcode-reader" 
              className={`rounded-lg overflow-hidden ${scannerActive ? 'block' : 'hidden'}`}
            ></div>
            
            {/* Placeholder shown when scanner is not active */}
            {!scannerActive && (
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Click the button below to start scanning
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          <div className="flex gap-4">
            {!scanning ? (
              <Button
                onClick={startScanning}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-start-scan"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Scanning
              </Button>
            ) : (
              <Button
                onClick={stopScanning}
                variant="outline"
                className="flex-1"
                data-testid="button-stop-scan"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Stop Scanning
              </Button>
            )}
          </div>

          {/* Verification Status */}
          {verificationStatus === "success" && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Verification Successful!</p>
                <p className="text-sm text-green-700">Redirecting to identity verification...</p>
              </div>
            </div>
          )}

          {verificationStatus === "error" && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Verification Failed</p>
                <p className="text-sm text-red-700">Barcode does not match. Please try again.</p>
              </div>
            </div>
          )}
        </Card>

        {/* Manual Entry */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h2 className="font-semibold text-lg mb-4">Manual Entry</h2>
          <p className="text-sm text-gray-600 mb-4">
            If scanning doesn't work, you can enter the barcode manually
          </p>
          
          <div className="flex gap-4">
            <Input
              type="text"
              placeholder="Enter barcode number"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              className="flex-1"
              data-testid="input-manual-barcode"
            />
            <Button
              onClick={handleManualVerify}
              variant="outline"
              data-testid="button-manual-verify"
            >
              Verify
            </Button>
          </div>
        </Card>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/student/auth")}
            data-testid="button-back"
          >
            ← Back to QR Scan
          </Button>
        </div>
      </div>
    </div>
  );
}
