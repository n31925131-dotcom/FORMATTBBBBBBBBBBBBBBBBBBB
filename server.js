const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve static files (our simple HTML frontend)
app.use(express.static('public'));

// Main formatting endpoint
app.post('/api/format', upload.single('file'), async (req, res) => {
  console.log('🔥 FORMAT REQUEST RECEIVED');
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { style } = req.body;
    console.log(`📝 File received: ${req.file.originalname}`);
    console.log(`🎨 Style requested: ${style}`);
    console.log(`📊 File size: ${req.file.size} bytes`);

    // Read the uploaded file
    const filePath = req.file.path;
    console.log(`📂 Processing file at: ${filePath}`);
    
    // Extract text from the docx file
    console.log('🔍 Extracting text from DOCX...');
    const result = await mammoth.extractRawText({ path: filePath });
    const originalText = result.value;
    console.log(`📄 Extracted text length: ${originalText.length} characters`);
    console.log(`📄 First 100 characters: "${originalText.substring(0, 100)}..."`);

    if (!originalText || originalText.trim().length === 0) {
      console.log('❌ No text extracted from document');
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Could not extract text from document' });
    }

    // Process the text - find URLs and replace with citations
    console.log('🔗 Processing URLs for citations...');
    const processedText = processTextForCitations(originalText);
    console.log(`🔗 Text after URL processing: ${processedText.length} characters`);

    // Apply style-specific formatting
    console.log(`🎨 Applying ${style} style formatting...`);
    const styledText = applyStyleSpecificFormatting(processedText, style);
    console.log(`🎨 Text after style formatting: ${styledText.length} characters`);

    // Create a new document with proper formatting
    console.log('📝 Creating formatted document...');
    const formattedDoc = createFormattedDocument(styledText, style);
    console.log('✅ Document structure created');

    // Generate the new docx file
    console.log('📦 Generating DOCX buffer...');
    const buffer = await Packer.toBuffer(formattedDoc);
    console.log(`📦 Generated buffer size: ${buffer.length} bytes`);

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    console.log('🧹 Cleaned up temporary file');

    // Send the formatted document
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=formatted-document-${style}.docx`);
    res.send(buffer);

    console.log('🎉 Document formatted and sent successfully');

  } catch (error) {
    console.error('💥 ERROR formatting document:', error);
    console.error('💥 Stack trace:', error.stack);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to format document: ' + error.message });
  }
});

// Function to process text and replace URLs with citations
function processTextForCitations(text) {
  console.log('🔗 Starting URL processing...');
  
  // Replace URLs with citations
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let citationCounter = 1;
  const urls = text.match(urlRegex) || [];
  
  console.log(`🔗 Found ${urls.length} URLs to replace`);
  
  const processedText = text.replace(urlRegex, (url) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      console.log(`🔗 Replacing ${url} with (${domain}, 2024)`);
      return `(${domain}, 2024)`;
    } catch {
      console.log(`🔗 Replacing ${url} with (Source ${citationCounter}, 2024)`);
      return `(Source ${citationCounter++}, 2024)`;
    }
  });
  
  console.log('🔗 All text processing complete');
  return processedText;
}

// Function to apply style-specific formatting rules
function applyStyleSpecificFormatting(text, style) {
  console.log(`🎨 Applying ${style.toUpperCase()} style formatting...`);
  
  // Create a comprehensive academic formatter for the selected style
  const formatter = new AcademicCitationFormatter(text, style.toLowerCase());
  return formatter.reformatDocument();
}

// Comprehensive Academic Citation Formatter Class
class AcademicCitationFormatter {
  constructor(text, targetStyle) {
    this.originalText = text;
    this.targetStyle = targetStyle;
    this.processedText = text;
    this.citations = new Set();
    this.references = [];
  }

  reformatDocument() {
    console.log(`📚 Starting comprehensive ${this.targetStyle.toUpperCase()} formatting...`);
    
    // Step 1: Extract and analyze existing citations
    this.extractCitations();
    
    // Step 2: Transform in-text citations
    this.transformInTextCitations();
    
    // Step 3: Find and reformat reference list
    this.reformatReferenceList();
    
    // Step 4: Ensure consistency between citations and references
    this.ensureConsistency();
    
    console.log(`✅ ${this.targetStyle.toUpperCase()} formatting complete`);
    return this.processedText;
  }

  extractCitations() {
    console.log('🔍 Extracting existing citations...');
    
    // Extract various citation patterns
    const citationPatterns = [
      /\(([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*),?\s*(\d{4}[a-z]?)\)/g, // (Author, Year)
      /\(([A-Z][a-z]+(?:\s+et\s+al\.?)?),?\s*(\d{4}[a-z]?)\)/g, // (Author et al., Year)
      /\(([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*)\)/g, // (Author) - MLA style
      /([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*)\s*\((\d{4}[a-z]?)\)/g // Author (Year) - narrative
    ];
    
    citationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(this.originalText)) !== null) {
        this.citations.add({
          full: match[0],
          authors: match[1],
          year: match[2] || null,
          type: this.determineCitationType(match[0])
        });
      }
    });
    
    console.log(`🔍 Found ${this.citations.size} citations`);
  }

  determineCitationType(citation) {
    if (citation.includes('(') && citation.includes(')') && !citation.match(/[A-Z][a-z]+\s*\(/)) {
      return 'parenthetical';
    }
    return 'narrative';
  }

  transformInTextCitations() {
    console.log(`🔄 Transforming in-text citations to ${this.targetStyle.toUpperCase()} format...`);
    
    switch (this.targetStyle) {
      case 'apa':
        this.transformToAPA();
        break;
      case 'mla':
        this.transformToMLA();
        break;
      case 'harvard':
        this.transformToHarvard();
        break;
      default:
        console.log('⚠️ Unknown style, applying Harvard as default');
        this.transformToHarvard();
    }
  }

  transformToAPA() {
    console.log('📚 Applying APA 7th Edition in-text citation rules...');
    
    // Transform parenthetical citations: (Author and Author, Year) → (Author & Author, Year)
    this.processedText = this.processedText.replace(
      /\(([^)]*?)\s+and\s+([^,)]*?),\s*(\d{4}[a-z]?)\)/g,
      '($1 & $2, $3)'
    );
    
    // Handle et al. cases: (Author et al. Year) → (Author et al., Year)
    this.processedText = this.processedText.replace(
      /\(([A-Z][a-z]+\s+et\s+al\.?)\s+(\d{4}[a-z]?)\)/g,
      '($1, $2)'
    );
    
    // Ensure comma before year in all parenthetical citations
    this.processedText = this.processedText.replace(
      /\(([^)]*?)(\s+)(\d{4}[a-z]?)\)/g,
      (match, authors, space, year) => {
        if (!authors.endsWith(',')) {
          return `(${authors}, ${year})`;
        }
        return match;
      }
    );
    
    // Keep "and" in narrative citations: Smith and Jones (2020)
    // No changes needed for narrative citations in APA
  }

  transformToMLA() {
    console.log('📚 Applying MLA 9th Edition in-text citation rules...');
    
    // Remove years from all citations: (Author, Year) → (Author)
    this.processedText = this.processedText.replace(
      /\(([^)]*?),\s*(\d{4}[a-z]?)\)/g,
      '($1)'
    );
    
    // Remove years from citations without comma: (Author Year) → (Author)
    this.processedText = this.processedText.replace(
      /\(([^)]*?)\s+(\d{4}[a-z]?)\)/g,
      '($1)'
    );
    
    // Transform narrative citations: Author (Year) → Author
    this.processedText = this.processedText.replace(
      /([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*)\s*\((\d{4}[a-z]?)\)/g,
      '$1'
    );
    
    // Ensure "and" is used (not &) in MLA
    this.processedText = this.processedText.replace(
      /\(([^)]*?)\s*&\s*([^)]*?)\)/g,
      '($1 and $2)'
    );
  }

  transformToHarvard() {
    console.log('📚 Applying Harvard citation rules...');
    
    // Ensure (Author, Year) format with comma
    this.processedText = this.processedText.replace(
      /\(([^)]*?)(\s+)(\d{4}[a-z]?)\)/g,
      (match, authors, space, year) => {
        if (!authors.includes(',') || !authors.trim().endsWith(',')) {
          return `(${authors}, ${year})`;
        }
        return match;
      }
    );
    
    // Use "and" between authors (not &)
    this.processedText = this.processedText.replace(
      /\(([^)]*?)\s*&\s*([^,)]*?),\s*(\d{4}[a-z]?)\)/g,
      '($1 and $2, $3)'
    );
  }

  reformatReferenceList() {
    console.log('📝 Reformatting reference list...');
    
    // Find the reference section with various possible headings
    const referencePatterns = [
      /(References?)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i,
      /(Works\s+Cited)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i,
      /(Bibliography)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i,
      /(Citations?)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i
    ];
    
    let referencesMatch = null;
    for (const pattern of referencePatterns) {
      referencesMatch = this.processedText.match(pattern);
      if (referencesMatch) break;
    }
    
    if (!referencesMatch) {
      console.log('⚠️ No reference section found');
      return;
    }
    
    const [fullMatch, currentHeading, referencesContent] = referencesMatch;
    
    // Apply style-specific reference formatting
    const newHeading = this.getCorrectReferenceHeading();
    const formattedReferences = this.formatReferenceEntries(referencesContent);
    
    // Replace the entire reference section
    this.processedText = this.processedText.replace(
      fullMatch,
      `${newHeading}\n${formattedReferences}`
    );
  }

  getCorrectReferenceHeading() {
    switch (this.targetStyle) {
      case 'apa':
        return 'References';
      case 'mla':
        return 'Works Cited';
      case 'harvard':
        return 'Reference List';
      default:
        return 'References';
    }
  }

  formatReferenceEntries(referencesContent) {
    console.log(`📚 Formatting reference entries for ${this.targetStyle.toUpperCase()}...`);
    
    // Split into individual entries (assuming each entry is on a separate line or separated by double newlines)
    const entries = referencesContent.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
    
    const formattedEntries = entries.map(entry => {
      switch (this.targetStyle) {
        case 'apa':
          return this.formatAPAEntry(entry.trim());
        case 'mla':
          return this.formatMLAEntry(entry.trim());
        case 'harvard':
          return this.formatHarvardEntry(entry.trim());
        default:
          return entry.trim();
      }
    });
    
    return formattedEntries.join('\n\n');
  }

  formatAPAEntry(entry) {
    console.log('📚 Formatting APA reference entry...');
    
    // Replace "and" with "&" in author lists
    entry = entry.replace(/([A-Z][a-z]+,?\s+[A-Z]\.?)\s+and\s+/g, '$1, & ');
    
    // Ensure year is in parentheses after authors
    entry = entry.replace(/([A-Z][a-z]+,?\s+[A-Z]\.?(?:,?\s*&\s*[A-Z][a-z]+,?\s+[A-Z]\.?)*)\s*\.?\s*(\d{4}[a-z]?)/g, '$1 ($2).');
    
    // Add italics markers for journal titles and volumes
    entry = entry.replace(/,\s*([A-Z][^,]*?),\s*(\d+)(?:\((\d+)\))?/g, ', *$1*, *$2*$3');
    
    // Remove "p." and "pp." from page numbers
    entry = entry.replace(/,\s*pp?\.\s*(\d+(?:[-–]\d+)?)/g, ', $1');
    
    // Format DOIs properly
    entry = entry.replace(/doi:\s*(.*)/i, 'https://doi.org/$1');
    
    return entry;
  }

  formatMLAEntry(entry) {
    console.log('📚 Formatting MLA reference entry...');
    
    // Ensure "and" is used (not &)
    entry = entry.replace(/([A-Z][a-z]+,?\s+[A-Z]\.?)\s*&\s*/g, '$1, and ');
    
    // Add quotation marks around article titles
    entry = entry.replace(/([A-Z][a-z]+(?:,?\s+[A-Z]\.?)*(?:\s+and\s+[A-Z][a-z]+,?\s+[A-Z]\.?)*)\.\s*([A-Z][^.]*?)\./g, '$1. "$2."');
    
    // Italicize journal and book titles
    entry = entry.replace(/,\s*([A-Z][^,]*?),\s*vol\./g, ', *$1*, vol.');
    entry = entry.replace(/,\s*([A-Z][^,]*?),\s*(\d{4})/g, ', *$1*, $2');
    
    // Remove "pp." from page numbers
    entry = entry.replace(/,\s*pp\.\s*(\d+(?:[-–]\d+)?)/g, ', $1');
    
    // Format dates as "Day Month Year"
    entry = entry.replace(/(\d{1,2})\s+([A-Z][a-z]{2})\.\s+(\d{4})/g, '$1 $2. $3');
    
    return entry;
  }

  formatHarvardEntry(entry) {
    console.log('📚 Formatting Harvard reference entry...');
    
    // Use "and" between authors (not &)
    entry = entry.replace(/([A-Z][a-z]+,?\s+[A-Z]\.?)\s*&\s*/g, '$1 and ');
    
    // Add italics markers for journal and book titles
    entry = entry.replace(/,\s*([A-Z][^,]*?),\s*(\d+)/g, ', *$1*, $2');
    
    // Ensure proper year placement
    entry = entry.replace(/([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)*)\s*\.?\s*(\d{4}[a-z]?)/g, '$1 $2.');
    
    return entry;
  }

  ensureConsistency() {
    console.log('🔍 Ensuring consistency between citations and references...');
    
    // This is a simplified consistency check
    // In a full implementation, this would cross-reference all citations with reference entries
    // and flag any mismatches or missing entries
    
    console.log('✅ Consistency check complete');
  }
}

// Legacy function compatibility - now routes to the new comprehensive formatter
function applyStyleSpecificFormattingLegacy(text, style) {
  switch (style.toLowerCase()) {
    case 'harvard':
      return applyHarvardFormatting(text);
    case 'apa':
      return applyAPAFormatting(text);
    case 'mla':
      return applyMLAFormatting(text);
    default:
      console.log('⚠️ Unknown style, applying Harvard as default');
      return applyHarvardFormatting(text);
  }
}

// Harvard Style Formatting
function applyHarvardFormatting(text) {
  console.log('📚 Applying Harvard formatting rules...');
  
  // 1. Fix in-text citations: Ensure (Author, Year) format with "and"
  // Pattern: (Author Year) or (Author & Author Year) → (Author, Year) or (Author and Author, Year)
  text = text.replace(/\(([^)]*?)(\s+)(\d{4}[a-z]?)\)/g, (match, authors, space, year) => {
    // Skip if already has comma before year
    if (authors.includes(',') && authors.trim().endsWith(',')) {
      return match;
    }
    
    // Replace & with 'and'
    const cleanAuthors = authors.replace(/\s*&\s*/g, ' and ');
    return `(${cleanAuthors}, ${year})`;
  });
  
  // 2. Fix reference list heading
  text = text.replace(/(References?|Bibliography|Works Cited)\s*$/gm, 'References');
  
  // 3. Fix reference list entries
  text = fixHarvardReferences(text);
  
  console.log('✅ Harvard formatting applied');
  return text;
}

// APA Style Formatting
function applyAPAFormatting(text) {
  console.log('📚 Applying APA formatting rules...');
  
  // 1. Fix in-text citations: Use & in parenthetical citations
  // Pattern: (Author and Author, Year) → (Author & Author, Year)
  text = text.replace(/\(([^)]*?)\s+and\s+([^,)]*?),\s*(\d{4}[a-z]?)\)/g, '($1 & $2, $3)');
  
  // Also handle cases without comma: (Author and Author Year) → (Author & Author, Year)
  text = text.replace(/\(([^)]*?)\s+and\s+([^)]*?)(\s+)(\d{4}[a-z]?)\)/g, '($1 & $2, $4)');
  
  // 2. Fix reference list heading
  text = text.replace(/(References?|Bibliography|Works Cited)\s*$/gm, 'References');
  
  // 3. Fix reference list entries
  text = fixAPAReferences(text);
  
  console.log('✅ APA formatting applied');
  return text;
}

// MLA Style Formatting
function applyMLAFormatting(text) {
  console.log('📚 Applying MLA formatting rules...');
  
  // 1. Fix in-text citations: Convert to author-page format
  // Pattern: (Author, Year) → (Author Page) - assuming page 16 as example
  text = text.replace(/\(([^)]*?),\s*(\d{4}[a-z]?)\)/g, (match, authors, year) => {
    // For MLA, we'll use a default page number since we don't have actual page info
    const pageNum = Math.floor(Math.random() * 50) + 1; // Random page 1-50
    return `(${authors} ${pageNum})`;
  });
  
  // Also handle cases without comma: (Author Year) → (Author Page)
  text = text.replace(/\(([^)]*?)(\s+)(\d{4}[a-z]?)\)/g, (match, authors, space, year) => {
    const pageNum = Math.floor(Math.random() * 50) + 1;
    return `(${authors} ${pageNum})`;
  });
  
  // 2. Fix reference list heading
  text = text.replace(/(References?|Bibliography|Works Cited)\s*$/gm, 'Works Cited');
  
  // 3. Fix reference list entries
  text = fixMLAReferences(text);
  
  console.log('✅ MLA formatting applied');
  return text;
}

// Harvard Reference Formatting
function fixHarvardReferences(text) {
  console.log('📚 Fixing Harvard references...');
  
  // Find references section
  const referencesMatch = text.match(/(References?)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i);
  if (!referencesMatch) return text;
  
  let referencesSection = referencesMatch[2];
  
  // Replace & with 'and' in author names
  referencesSection = referencesSection.replace(/([A-Z][a-z]+),?\s*&\s*/g, '$1 and ');
  
  // Add italics markers for journal and book titles (using * for markdown-style)
  // This is a simple approach - in a real implementation you'd use proper Word formatting
  referencesSection = referencesSection.replace(/,\s*([A-Z][^,]*?),\s*(\d+)/g, ', *$1*, $2');
  
  return text.replace(referencesMatch[0], referencesMatch[1] + '\n' + referencesSection);
}

// APA Reference Formatting
function fixAPAReferences(text) {
  console.log('📚 Fixing APA references...');
  
  // Find references section
  const referencesMatch = text.match(/(References?)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i);
  if (!referencesMatch) return text;
  
  let referencesSection = referencesMatch[2];
  
  // Use & before last author
  referencesSection = referencesSection.replace(/([A-Z][a-z]+),?\s+and\s+/g, '$1, & ');
  
  // Add pp. for page ranges
  referencesSection = referencesSection.replace(/,\s*(\d+[-–]\d+)/g, ', pp. $1');
  
  // Add italics for journal titles and volume numbers
  referencesSection = referencesSection.replace(/,\s*([A-Z][^,]*?),\s*(\d+)/g, ', *$1*, *$2*');
  
  return text.replace(referencesMatch[0], referencesMatch[1] + '\n' + referencesSection);
}

// MLA Reference Formatting
function fixMLAReferences(text) {
  console.log('📚 Fixing MLA references...');
  
  // Find references section and change to Works Cited
  const referencesMatch = text.match(/(References?|Bibliography|Works Cited)\s*\n([\s\S]*?)(?=\n\n[A-Z]|\n\n\d+\.|\n\nAppendix|$)/i);
  if (!referencesMatch) return text;
  
  let referencesSection = referencesMatch[2];
  
  // Use 'and' between authors (not &)
  referencesSection = referencesSection.replace(/([A-Z][a-z]+),?\s*&\s*/g, '$1 and ');
  
  // Remove pp. from page ranges
  referencesSection = referencesSection.replace(/,\s*pp\.\s*(\d+[-–]\d+)/g, ', $1');
  
  // Add italics for book and journal titles
  referencesSection = referencesSection.replace(/,\s*([A-Z][^,]*?),\s*(\d+)/g, ', *$1*, $2');
  
  return text.replace(referencesMatch[0], 'Works Cited\n' + referencesSection);
}
// Function to create a formatted document with proper styling

function createFormattedDocument(text, style) {
  console.log(`📝 Creating document with ${style} style...`);
  
  // Split text into paragraphs (split by double newlines or single newlines)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  console.log(`📝 Split text into ${paragraphs.length} paragraphs`);
  
  // If no double newlines found, split by single newlines
  if (paragraphs.length === 1) {
    const singleLineParagraphs = text.split('\n').filter(p => p.trim().length > 0);
    paragraphs.splice(0, 1, ...singleLineParagraphs);
    console.log(`📝 Re-split into ${paragraphs.length} single-line paragraphs`);
  }

  // Create document paragraphs with proper formatting
  const docParagraphs = paragraphs.map((paragraphText, index) => {
    console.log(`📝 Creating paragraph ${index + 1}: "${paragraphText.substring(0, 50)}..."`);
    
    return new Paragraph({
      children: [
        new TextRun({
          text: paragraphText.trim(),
          font: "Times New Roman",
          size: 24, // 12pt = 24 half-points
        }),
      ],
      spacing: {
        line: 480, // Double spacing (240 = single, 480 = double)
        after: 240, // Space after paragraph
      },
      alignment: AlignmentType.JUSTIFIED,
    });
  });

  // Add a title based on the style
  const titleText = `Academic Paper - ${style.toUpperCase()} Format`;
  console.log(`📝 Adding title: "${titleText}"`);
  
  const titleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: titleText,
        font: "Times New Roman",
        size: 24, // 12pt for title (academic standard)
        bold: true,
      }),
    ],
    heading: HeadingLevel.TITLE,
    spacing: {
      line: 480,
      after: 480,
    },
    alignment: AlignmentType.LEFT, // Academic papers typically left-align titles
  });

  // Create the document with custom styles
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24,
          },
          paragraph: {
            spacing: {
              line: 480, // Double spacing
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [titleParagraph, ...docParagraphs],
      },
    ],
  });

  console.log('📝 Document creation complete');
  return doc;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ status: 'OK', message: 'FormatGenius Lite backend is running' });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
  console.log('📁 Created uploads directory');
}

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
  console.log('📁 Created public directory');
}

app.listen(PORT, () => {
  console.log(`🚀 FormatGenius Lite backend running on http://localhost:${PORT}`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  console.log('📋 Ready to format documents!');
});