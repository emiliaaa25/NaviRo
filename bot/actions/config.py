class Config:
    BOT_DEFAULT_NAME = "Bot"
    SUPPORTED_REFERENCE_FILES = ["txt", "json", "csv"]
    UAIC_REFERENCE_URL_PATTERN = "https://www.uaic.ro/studii/facultati-2/[FILE_NAME]"
    UAIC_ADMITERE_REFERENCE_URL_PATTERN = "https://admitere.uaic.ro/[FILE_NAME]"  # De adaugat url ul la site-urile de unde luam info

    DB_HOST = "localhost"
    DB_PORT = 5432
    DB_NAME = "iasi_quest_db"
    DB_USER = "postgres"
    DB_PASSWORD = "Abcd123"
    DB_CONNECTION_STRING = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    #########################################
    ####### AZURE OPEN AI Configs ###########
    #########################################
    AZURE_PROJECT_ENDPOINT = "https://virtual-assistant-team--resource.services.ai.azure.com/api/projects/virtual-assistant-team-project"
    AZURE_AGENT_NAME = "Test-agent"
    AZURE_AGENT_VERSION = "10"
    AZURE_ASSISTANT_ID = "9f76828d-b392-44d8-b17a-84bdd5dae546"
    AZURE_API_KEY = "7K13zSno3ZlbGv2HFibaXxhWGYh58JLFSNeBWf4lNEA8gy8JWIPMJQQJ99CDACfhMk5XJ3w3AAAAACOGk4Fo"
    AZURE_API_VERSION = "2025-11-15-preview"
    AZURE_DEPLOYMENT_NAME = "gpt-4o"
    SYSTEM_PROMPT = ""
    TOOLS = []
