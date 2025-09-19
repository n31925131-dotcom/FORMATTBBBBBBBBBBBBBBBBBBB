const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');

console.log('🚀 Starting DOCX formatting test...');

// Hardcoded test text
const testText = "This is a test sentence. This text should appear in Times New Roman 12pt font with double spacing. If you can see this formatted correctly, the docx library is working properly.";

console.log('📝 Creating document with test text...');
console.log(`📄 Text to format: "${testText}"`);

// Create a new document with proper formatting
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: "Times New Roman",
          size: 24, // 12pt = 24 half-points
        },
        paragraph: {
          spacing: {
            line: 480, // Double spacing (240 = single, 480 = double)
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
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: testText,
              font: "Times New Roman",
              size: 24, // 12pt font
            }),
          ],
          spacing: {
            line: 480, // Double spacing
            after: 240, // Space after paragraph
          },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "This is a second paragraph to test multiple paragraphs with the same formatting.",
              font: "Times New Roman",
              size: 24,
            }),
          ],
          spacing: {
            line: 480,
            after: 240,
          },
        }),
      ],
    },
  ],
});

console.log('📦 Converting document to buffer...');

// Generate the document and save it
Packer.toBuffer(doc).then((buffer) => {
  console.log('💾 Saving document to test-output.docx...');
  
  fs.writeFileSync('test-output.docx', buffer);
  
  console.log('✅ SUCCESS! Document saved as test-output.docx');
  console.log('📂 Open test-output.docx in Microsoft Word or Google Docs to verify:');
  console.log('   - Font should be Times New Roman');
  console.log('   - Font size should be 12pt');
  console.log('   - Text should be double-spaced');
  console.log('   - Margins should be 1 inch on all sides');
}).catch((error) => {
  console.error('❌ ERROR creating document:', error);
  console.error('💥 Stack trace:', error.stack);
});