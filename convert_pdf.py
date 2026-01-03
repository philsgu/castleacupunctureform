import base64

try:
    with open('../new_pt_packet_2025.pdf', 'rb') as pdf_file:
        encoded_string = base64.b64encode(pdf_file.read()).decode('utf-8')
    
    ts_content = f'export const PDF_TEMPLATE = "{encoded_string}";\n'
    
    with open('convex/template.ts', 'w') as ts_file:
        ts_file.write(ts_content)
        
    print("Successfully converted PDF to convex/template.ts")
except Exception as e:
    print(f"Error: {e}")
