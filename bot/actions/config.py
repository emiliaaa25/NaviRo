class Config:
    import os
    
    BOT_DEFAULT_NAME = "Bot"
    SUPPORTED_REFERENCE_FILES = ["txt", "json", "csv"]
    UAIC_REFERENCE_URL_PATTERN = "https://www.uaic.ro/studii/facultati-2/[FILE_NAME]"
    UAIC_ADMITERE_REFERENCE_URL_PATTERN = "https://admitere.uaic.ro/[FILE_NAME]"

    # Database configuration from environment or defaults
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', '5432'))
    DB_NAME = os.getenv('DB_NAME', 'iasi_quest_db')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
    DB_CONNECTION_STRING = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    #########################################
    ####### AZURE OPEN AI Configs ###########
    #########################################
    AZURE_PROJECT_ENDPOINT = "https://virtual-assistant-team--resource.services.ai.azure.com/api/projects/virtual-assistant-team-project"
    AZURE_AGENT_NAME = "Test-agent"
    AZURE_AGENT_VERSION = "12"
    AZURE_ASSISTANT_ID = "9f76828d-b392-44d8-b17a-84bdd5dae546"
    AZURE_API_KEY = "7K13zSno3ZlbGv2HFibaXxhWGYh58JLFSNeBWf4lNEA8gy8JWIPMJQQJ99CDACfhMk5XJ3w3AAAAACOGk4Fo"
    AZURE_API_VERSION = "2025-11-15-preview"
    AZURE_DEPLOYMENT_NAME = "gpt-4o"
    SYSTEM_PROMPT = """You are NaviRo, an expert relocation assistant for international students moving to Iași, Romania.

Your responsibilities:
1. Provide accurate legal, administrative, and procedural guidance for student relocation
2. Adapt your advice based on the student's nationality (EU vs Non-EU) and current migration milestone
3. Reference only verified official sources - never hallucinate URLs or organizations
4. Be empathetic but precise - administrative errors can have serious consequences
5. When in doubt, direct students to official sources or the university's international office

Key competencies:
- Romanian visa and residence permit procedures
- Erasmus+ (MAE) documentation and funding
- Student housing and accommodation in Iași
- Health insurance requirements (IGI for international students)
- University admission procedures at UAIC (Universitatea Alexandru Ioan Cuza)
- Financial documentation and proof of funds
- Language requirements and certifications"""
    TOOLS = []

    # Google OAuth configuration
    GOOGLE_CLIENT_ID = "637432744098-edegr6i8gr13ko8vvfk18f2a3rf05shc.apps.googleusercontent.com"