# Folosim imaginea oficială de la Rasa pentru Action Server
FROM rasa/rasa-sdk:3.6.0

# Ne mutăm în folderul de lucru
WORKDIR /app

# Copiem fișierele de dependențe (le creăm la pasul următor)
COPY requirements.txt ./

# Instalăm librăriile necesare (pentru baza de date, etc.)
USER root
RUN pip install --no-cache-dir -r requirements.txt

# Copiem restul codului din folderul actions în container
COPY . /app

# Ne întoarcem la userul default pentru securitate
USER 1001