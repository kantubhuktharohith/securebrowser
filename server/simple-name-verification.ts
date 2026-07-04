// Simple name-based verification to replace complex AI system
// Just extracts name from ID document and compares with hall ticket

interface NameVerificationResult {
  isValid: boolean;
  confidence: number;
  extractedName?: string;
  reason: string;
}

// Simple fuzzy string matching for names
function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names: lowercase, remove extra spaces, common prefixes
  const normalize = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof)\b\.?/g, '') // Remove titles
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };
  
  const norm1 = normalize(name1);
  const norm2 = normalize(name2);
  
  // Direct match
  if (norm1 === norm2) return 1.0;
  
  // Split into words and check overlap
  const words1 = norm1.split(' ').filter(w => w.length > 1);
  const words2 = norm2.split(' ').filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count matching words
  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  
  // Return ratio of matching words
  return matches / Math.max(words1.length, words2.length);
}

// Simple text extraction from image using browser APIs
export async function extractNameFromDocument(
  imageBase64: string,
  expectedName: string
): Promise<NameVerificationResult> {
  try {
    console.log("Starting simple name extraction...");
    
    // For now, use a basic OCR approach
    // In production, you could use Tesseract.js or similar client-side OCR
    // For this demo, we'll simulate extraction and do pattern matching
    
    // Convert base64 to image and try to extract text
    const extractedText = await performBasicOCR(imageBase64);
    
    // Look for name patterns in extracted text
    const extractedName = findNameInText(extractedText);
    
    if (!extractedName) {
      return {
        isValid: false,
        confidence: 0,
        reason: "Could not extract name from document. Please ensure the image is clear and contains readable text."
      };
    }
    
    // Compare with expected name
    const similarity = calculateNameSimilarity(extractedName, expectedName);
    
    console.log(`Name comparison: "${extractedName}" vs "${expectedName}" = ${Math.round(similarity * 100)}% similarity`);
    
    // Accept if similarity is 50% or higher (more lenient for real-world scenarios)
    // This allows for middle names, initials, nickname variations, etc.
    if (similarity >= 0.5) {
      return {
        isValid: true,
        confidence: similarity,
        extractedName,
        reason: `Name match found: "${extractedName}" matches "${expectedName}" (${Math.round(similarity * 100)}% similarity)`
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        extractedName,
        reason: `Name mismatch: extracted "${extractedName}" doesn't match "${expectedName}" (${Math.round(similarity * 100)}% similarity, need 50%)`
      };
    }
    
  } catch (error) {
    console.error("Name extraction error:", error);
    return {
      isValid: false,
      confidence: 0,
      reason: "Failed to process document. Please try uploading a clearer image."
    };
  }
}

// Realistic OCR using OpenAI Vision for text extraction
async function performBasicOCR(imageBase64: string): Promise<string> {
  try {
    // Use OpenAI Vision to extract text from the document
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast model for text extraction
      messages: [
        {
          role: "system",
          content: "Extract all visible text from this ID document. Return just the raw text, no analysis."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this ID document:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 200 // Just need text extraction
    });

    return response.choices[0]?.message?.content || "";
    
  } catch (error) {
    console.error("OCR extraction failed:", error);
    // Fallback: return empty string so name matching will fail gracefully
    return "";
  }
}

// Extract name patterns from OCR text - Improved version
function findNameInText(text: string): string | null {
  console.log("Raw OCR text:", text);
  
  // Common name patterns in ID documents (ordered by reliability)
  const namePatterns = [
    /name[:\s]+([a-zA-Z\s]{4,50})/i,           // "Name: John Doe"
    /^name[:\s]*\n([a-zA-Z\s]{4,50})/im,       // "Name:" on one line, name on next
    /holder[:\s]+([a-zA-Z\s]{4,50})/i,         // "Holder: John Doe"
    /student[:\s]+([a-zA-Z\s]{4,50})/i,        // "Student: John Doe"
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/m, // First Middle? Last pattern
    /([A-Z][A-Z\s]{8,40})/,                    // All caps name (longer matches)
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1]
        .replace(/\n/g, ' ')         // Replace newlines with spaces
        .replace(/\s+/g, ' ')        // Normalize spaces
        .trim();
      
      // Filter out common non-name text and validate
      const isValidName = 
        name.length >= 4 &&          // At least 4 characters
        name.length <= 50 &&         // Not too long
        !name.match(/\d/) &&         // No digits
        !name.match(/[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/]/) && // No special chars
        !name.match(/GOVERNMENT|DEPARTMENT|CARD|LICENSE|PASSPORT|IDENTITY/i); // No common doc words
      
      if (isValidName) {
        console.log(`Found name using pattern ${pattern}: "${name}"`);
        return name;
      }
    }
  }
  
  // Fallback: Try to extract any capitalized words that look like names
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter(w => 
    w.length > 2 && 
    w[0] === w[0].toUpperCase() && 
    !w.match(/\d/) &&
    !w.match(/GOVERNMENT|CARD|LICENSE|PASSPORT|IDENTITY/i)
  );
  
  if (capitalizedWords.length >= 2) {
    const fallbackName = capitalizedWords.slice(0, 3).join(' ');
    console.log(`Fallback name extraction: "${fallbackName}"`);
    return fallbackName;
  }
  
  console.log("No name found in text");
  return null;
}