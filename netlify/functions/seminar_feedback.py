import sys
import os
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

def main(csv_file, output_pdf):
    # Read the CSV
    df = pd.read_csv(csv_file)

    # --- All of your data processing logic remains the same ---
    feedback_cols = [col for col in df.columns if '[' in col and ']' in col]
    feedback_data = df[feedback_cols]
    feedback_data = feedback_data.applymap(lambda x: str(x).split(':')[0] if isinstance(x, str) else x)
    feedback_data.columns = ['Importance', 'Methods', 'Results', 'Future_Discussion', 'Quality_of_Research', 'Quality_of_Presentation']
    feedback_data = feedback_data.apply(pd.to_numeric, errors='coerce')
    mean_score = feedback_data.mean(axis=1).mean()

    with PdfPages(output_pdf) as pdf:
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
        
        # ... (other plotting pages remain the same) ...
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

    # A success message printed to stdout can be useful for debugging
    print(f"Successfully generated PDF at {output_pdf}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python seminar_feedback.py <input_csv_path> <output_pdf_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    main(input_path, output_path)
