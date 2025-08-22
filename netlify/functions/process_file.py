import base64
import cgi
import io
import json
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

def handler(event, context):
    # --- 1. Parse the multipart/form-data request ---
    try:
        if not event.get('isBase64Encoded', False):
            raise ValueError("Request body must be base64 encoded.")
            
        body = base64.b64decode(event['body'])
        headers = event['headers']
        
        # cgi.parse_header is crucial for getting the boundary
        ctype, pdict = cgi.parse_header(headers.get('content-type') or headers.get('Content-Type'))
        pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
        
        # Parse the form data to get the file content
        form_data = cgi.parse_multipart(io.BytesIO(body), pdict)
        file_content = form_data.get('file')[0]
        
        # Read the file content into a pandas DataFrame
        csv_file = io.BytesIO(file_content)
        df = pd.read_csv(csv_file)
        
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f'Failed to parse uploaded file: {str(e)}'})
        }

    # --- 2. Run your original processing logic ---
    # Get feedback columns (those with brackets in their names)
    feedback_cols = [col for col in df.columns if '[' in col and ']' in col]
    feedback_data = df[feedback_cols]
    
    # For each column, split values at ':' and take the first part
    feedback_data = feedback_data.applymap(lambda x: str(x).split(':')[0] if isinstance(x, str) else x)
    feedback_data.columns = ['Importance', 'Methods', 'Results', 'Future_Discussion', 'Quality_of_Research', 'Quality_of_Presentation']
    feedback_data = feedback_data.apply(pd.to_numeric, errors='coerce')
    mean_score = feedback_data.mean(axis=1).mean()

    # --- 3. Generate the PDF in memory ---
    pdf_buffer = io.BytesIO()
    with PdfPages(pdf_buffer) as pdf:
        # Page 1: Heatmap
        plt.figure(figsize=(10, 8))
        sns.heatmap(feedback_data, annot=False, cmap='coolwarm', cbar=True, linewidths=0.5)
        plt.title('Seminar Feedback Heatmap', fontsize=18)
        plt.xlabel('Feedback Category', fontsize=14)
        plt.xticks(rotation=45, ha='right', fontsize=12)
        plt.ylabel('Responses', fontsize=14)
        plt.tight_layout()
        pdf.savefig()
        plt.close()

        # Page 2: Mean Overall Score
        plt.figure(figsize=(8.5, 11))
        plt.axis('off')
        plt.text(0.5, 0.5, f'Mean Overall Score: {mean_score:.2f}', ha='center', va='center', fontsize=32)
        pdf.savefig()
        plt.close()
        
        # Page 3: Key Takeaways
        plt.figure(figsize=(8.5, 11))
        plt.axis('off')
        takeaways = df.iloc[:, 6].dropna().astype(str).tolist()
        takeaways_text = "\n\n• ".join(takeaways)
        plt.text(0.05, 0.95, "Key Takeaways:\n\n• " + takeaways_text, fontsize=12, va='top', wrap=True)
        pdf.savefig()
        plt.close()

        # Page 4: Speaker Strengths
        plt.figure(figsize=(8.5, 11))
        plt.axis('off')
        strengths = df.iloc[:, 7].dropna().astype(str).tolist()
        strengths_text = "\n\n• ".join(strengths)
        plt.text(0.05, 0.95, "Speaker Strengths:\n\n• " + strengths_text, fontsize=12, va='top', wrap=True)
        pdf.savefig()
        plt.close()

        # Page 5: Suggestions for Improvement
        plt.figure(figsize=(8.5, 11))
        plt.axis('off')
        improvements = df.iloc[:, 8].dropna().astype(str).tolist()
        improvements_text = "\n\n• ".join(improvements)
        plt.text(0.05, 0.95, "Suggestions for Improvement:\n\n• " + improvements_text, fontsize=12, va='top', wrap=True)
        pdf.savefig()
        plt.close()
        
    pdf_buffer.seek(0)

    # --- 4. Return the PDF as a downloadable attachment ---
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="seminar_summary.pdf"'
        },
        'body': base64.b64encode(pdf_buffer.read()).decode('utf-8'),
        'isBase64Encoded': True
    }
