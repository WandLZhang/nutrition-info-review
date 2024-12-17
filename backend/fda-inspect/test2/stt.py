import speech_recognition as sr
import sys

def speech_to_text():
    recognizer = sr.Recognizer()

    with sr.Microphone() as source:
        print("Listening... Speak now!")
        
        recognizer.adjust_for_ambient_noise(source, duration=1)
        recognizer.dynamic_energy_threshold = True
        
        try:
            audio_data = recognizer.listen(source, timeout=5, phrase_time_limit=15)
            print("Processing speech...", end='\r')

            text = recognizer.recognize_google(audio_data)
            
            sys.stdout.write('\033[K')
            print(text, end='')
            sys.stdout.flush()

            additional_input = input()
            
            final_text = text + additional_input
            
            print("\nFinal text:", final_text)

        except sr.WaitTimeoutError:
            print("No speech detected within the timeout period.")
        except sr.UnknownValueError:
            print("Sorry, I couldn't understand what you said.")
        except sr.RequestError as e:
            print(f"Could not request results from Google Speech Recognition service; {e}")

if __name__ == "__main__":
    speech_to_text()
