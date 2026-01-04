import base64

with open("Gina_Sig.jpg", "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

with open("convex/assets.ts", "w") as ts_file:
    ts_file.write(f'export const OFFICE_SIG_BASE64 = "data:image/jpeg;base64,{encoded_string}";\n')

print("Successfully created convex/assets.ts")
