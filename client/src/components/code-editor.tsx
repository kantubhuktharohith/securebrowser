import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

interface CodeEditorProps {
  initialCode: string;
  testCases: TestCase[];
  language: string;
  onChange: (value: string) => void;
  onTestResults?: (results: TestResult[]) => void;
  readOnly?: boolean;
}

export default function CodeEditor({
  initialCode,
  testCases,
  language,
  onChange,
  onTestResults,
  readOnly = false,
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode || "// Write your code here\n");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "output" | "tests">("editor");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      onChange(newCode);
    },
    [onChange]
  );

  // Handle tab key in textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newCode = code.substring(0, start) + "  " + code.substring(end);
        setCode(newCode);
        onChange(newCode);
        // Set cursor position after tab
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    },
    [code, onChange]
  );

  // Execute JavaScript code safely in an iframe sandbox
  const executeCode = useCallback(
    async (inputCode: string, input: string): Promise<{ output: string; error?: string }> => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ output: "", error: "Execution timed out (5s limit)" });
        }, 5000);

        try {
          // Create sandboxed iframe for execution
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.sandbox.add("allow-scripts");
          document.body.appendChild(iframe);

          const iframeWindow = iframe.contentWindow;
          if (!iframeWindow) {
            clearTimeout(timeout);
            resolve({ output: "", error: "Failed to create sandbox" });
            return;
          }

          // Capture console.log output
          const logs: string[] = [];

          // Inject the code into iframe
          const wrappedCode = `
            <script>
              var __logs = [];
              var console = { log: function() { __logs.push(Array.from(arguments).join(' ')); } };
              try {
                var __input = ${JSON.stringify(input)};
                ${inputCode}
                parent.postMessage({ type: 'result', output: __logs.join('\\n'), error: null }, '*');
              } catch (e) {
                parent.postMessage({ type: 'result', output: __logs.join('\\n'), error: e.message }, '*');
              }
            </script>
          `;

          const handler = (event: MessageEvent) => {
            if (event.data?.type === "result") {
              clearTimeout(timeout);
              window.removeEventListener("message", handler);
              document.body.removeChild(iframe);
              resolve({
                output: event.data.output || "",
                error: event.data.error || undefined,
              });
            }
          };

          window.addEventListener("message", handler);
          iframe.srcdoc = wrappedCode;

          // Fallback timeout for cleanup
          setTimeout(() => {
            window.removeEventListener("message", handler);
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 6000);
        } catch (error) {
          clearTimeout(timeout);
          resolve({
            output: "",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    },
    []
  );

  const runTests = useCallback(async () => {
    setIsRunning(true);
    setConsoleOutput([]);
    const results: TestResult[] = [];

    const visibleTests = testCases.filter((tc) => !tc.isHidden);

    for (const testCase of visibleTests) {
      const { output, error } = await executeCode(code, testCase.input);
      const actualOutput = output.trim();
      const expectedOutput = testCase.expectedOutput.trim();

      results.push({
        input: testCase.input,
        expectedOutput,
        actualOutput,
        passed: !error && actualOutput === expectedOutput,
        error,
      });
    }

    setTestResults(results);
    setConsoleOutput(results.map((r, i) => 
      `Test ${i + 1}: ${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.error ? `(Error: ${r.error})` : ""}`
    ));
    setIsRunning(false);
    setActiveTab("tests");

    // Send results for grading
    onTestResults?.(results);

    // Also update the answer with test results embedded
    const resultsPayload = JSON.stringify({
      code,
      testResults: results.map((r) => ({
        passed: r.passed,
        input: r.input,
        expectedOutput: r.expectedOutput,
        actualOutput: r.actualOutput,
      })),
    });
    onChange(resultsPayload);
  }, [code, testCases, executeCode, onTestResults, onChange]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    const { output, error } = await executeCode(code, "");
    setConsoleOutput(error ? [`Error: ${error}`] : [output || "(no output)"]);
    setIsRunning(false);
    setActiveTab("output");
  }, [code, executeCode]);

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalVisible = testCases.filter((tc) => !tc.isHidden).length;
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-950" data-code-editor="true">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <i className="fas fa-code text-emerald-400 text-sm" />
          <span className="text-sm font-medium text-gray-300">{language || "JavaScript"}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runCode}
            disabled={isRunning || readOnly}
            className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <i className="fas fa-play mr-1 text-green-400" />
            Run
          </Button>
          {testCases.length > 0 && (
            <Button
              size="sm"
              onClick={runTests}
              disabled={isRunning || readOnly}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <i className="fas fa-flask mr-1" />
              Run Tests ({totalVisible}{hiddenCount > 0 ? `+${hiddenCount} hidden` : ""})
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {(["editor", "output", "tests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-gray-900"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "editor" && <><i className="fas fa-file-code mr-1" />Code</>}
            {tab === "output" && <><i className="fas fa-terminal mr-1" />Output</>}
            {tab === "tests" && (
              <>
                <i className="fas fa-check-circle mr-1" />
                Tests
                {testResults.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    passedCount === totalVisible
                      ? "bg-emerald-900 text-emerald-300"
                      : "bg-red-900 text-red-300"
                  }`}>
                    {passedCount}/{totalVisible}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="relative" style={{ minHeight: "300px" }}>
        {/* Code Editor */}
        {activeTab === "editor" && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-gray-900 border-r border-gray-800 flex flex-col items-end pt-3 pr-2 text-gray-600 text-xs font-mono select-none">
              {code.split("\n").map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              readOnly={readOnly}
              className="w-full bg-transparent text-emerald-300 font-mono text-sm p-3 pl-12 resize-none focus:outline-none leading-6"
              style={{ minHeight: "300px", tabSize: 2 }}
              spellCheck={false}
              data-testid="code-editor-textarea"
            />
          </div>
        )}

        {/* Console Output */}
        {activeTab === "output" && (
          <div className="p-3 font-mono text-sm text-gray-300 min-h-[300px]">
            {consoleOutput.length === 0 ? (
              <p className="text-gray-600">Click "Run" to see output...</p>
            ) : (
              consoleOutput.map((line, i) => (
                <div key={i} className="leading-6">
                  <span className="text-gray-600 mr-2">{">"}</span>
                  {line}
                </div>
              ))
            )}
          </div>
        )}

        {/* Test Results */}
        {activeTab === "tests" && (
          <div className="p-3 space-y-2 min-h-[300px]">
            {testResults.length === 0 ? (
              <p className="text-gray-600 text-sm">Click "Run Tests" to execute test cases...</p>
            ) : (
              <>
                {/* Summary */}
                <div className={`p-2 rounded text-sm font-medium ${
                  passedCount === totalVisible
                    ? "bg-emerald-900/50 text-emerald-300"
                    : "bg-red-900/50 text-red-300"
                }`}>
                  {passedCount === totalVisible
                    ? `✅ All ${totalVisible} tests passed!`
                    : `${passedCount}/${totalVisible} tests passed`}
                  {hiddenCount > 0 && (
                    <span className="text-gray-500 ml-2">
                      ({hiddenCount} hidden test{hiddenCount !== 1 ? "s" : ""} will be evaluated on submission)
                    </span>
                  )}
                </div>

                {/* Individual results */}
                {testResults.map((result, i) => (
                  <div
                    key={i}
                    className={`border rounded p-2 text-xs font-mono ${
                      result.passed
                        ? "border-emerald-800 bg-emerald-950/30"
                        : "border-red-800 bg-red-950/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={result.passed ? "text-emerald-400" : "text-red-400"}>
                        {result.passed ? "✅" : "❌"} Test {i + 1}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Input: <span className="text-gray-300">{result.input}</span>
                    </div>
                    <div className="text-gray-500">
                      Expected: <span className="text-emerald-300">{result.expectedOutput}</span>
                    </div>
                    <div className="text-gray-500">
                      Got: <span className={result.passed ? "text-emerald-300" : "text-red-300"}>
                        {result.actualOutput || "(no output)"}
                      </span>
                    </div>
                    {result.error && (
                      <div className="text-red-400 mt-1">Error: {result.error}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Running indicator */}
        {isRunning && (
          <div className="absolute inset-0 bg-gray-950/80 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-emerald-400">
              <div className="animate-spin w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full" />
              <span className="text-sm">Executing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
