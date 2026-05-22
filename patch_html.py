import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace hardcoded plans in #plans-activos with an empty container
# They are under <div id="plans-activos"> up to the next </div> (Historial)
# But it has month-nav inside it.
# We better keep month-nav and just empty the cards.
activos_pattern = r'(<div id="plans-activos">.*?<div class="month-nav" style="margin-bottom:10px;">.*?</div>).*?(<div id="plans-historial" style="display:none;">)'
html = re.sub(activos_pattern, r'\1\n<div id="plans-activos-list"></div>\n</div>\n\2', html, flags=re.DOTALL)

# Replace hardcoded plans in #plans-historial
historial_pattern = r'(<div id="plans-historial" style="display:none;">.*?<div class="month-nav" style="margin-bottom:10px;">.*?</div>).*?(</div>\s*</div>\s*<!-- Botón FAB -->)'
html = re.sub(historial_pattern, r'\1\n<div id="plans-historial-list"></div>\n</div>\n\2', html, flags=re.DOTALL)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("HTML patched successfully!")
