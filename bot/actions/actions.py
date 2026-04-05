from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

# O acțiune simplă de test
class ActionHelloWorld(Action):
    def name(self) -> Text:
        return "action_hello_world"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(text="Salut! Sunt serverul de acțiuni și funcționez!")
        return []
    
def handle_action(action_name, action_arguments, sender_id):
    action_output = None
    if action_name == "trigger_send_feedback":
        print("FEEDBACK ACTION TRIGGERED")
        # action_output = send_feedback(action_arguments, sender_id)
    # elif action_name == "other_function_name":
    #     action_output = other_function(action_arguments, sender_id)

    print("\tOUTPUT", action_output)
    return action_output