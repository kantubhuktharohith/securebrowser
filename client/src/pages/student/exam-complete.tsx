import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function ExamComplete() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Clean up any remaining fullscreen or exam state
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const handleGoHome = () => {
    // Clean up any remaining exam data
    localStorage.removeItem("hallTicketData");
    localStorage.removeItem("verificationComplete");
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-orbs" style={{ background: 'linear-gradient(135deg, hsl(140, 30%, 97%) 0%, hsl(180, 25%, 95%) 50%, hsl(220, 25%, 97%) 100%)' }}>
      <Card className="w-full max-w-2xl shadow-2xl shadow-emerald-500/8 border-0 bg-white/80 backdrop-blur-xl animate-scale-in relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/25">
            <i className="fas fa-check text-3xl text-white"></i>
          </div>
          <CardTitle className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400" style={{ fontFamily: 'var(--font-heading)' }}>
            Exam Submitted Successfully!
          </CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-6 px-8 pb-8">
          <div className="space-y-2">
            <p className="text-lg text-foreground font-medium">
              Thank you for your patience during the examination.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your answers have been securely submitted and recorded. 
              You will be notified of your results once they are available.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 text-left">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <i className="fas fa-info-circle text-indigo-500 text-sm"></i>
              What happens next?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2.5">
              {[
                "Your exam responses are being processed",
                "Results will be available within 24-48 hours",
                "You will receive notification via email",
                "Contact support if you have any concerns"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <i className="fas fa-check-circle text-emerald-500 text-xs mt-1 flex-shrink-0"></i>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <Button 
              onClick={handleGoHome}
              size="lg"
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 btn-shine h-12"
              data-testid="button-home"
            >
              <i className="fas fa-home mr-2"></i>
              Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}