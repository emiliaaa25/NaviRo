"""Voice processing utilities for transcription and TTS."""

import os
import io
import tempfile
import pyttsx3
import speech_recognition as sr
from pathlib import Path


class VoiceProcessor:
    """Handles voice transcription and text-to-speech operations."""
    
    
    _tts_engine = None

    @staticmethod
    def get_tts_engine():
        """Get or initialize the TTS engine."""
        if VoiceProcessor._tts_engine is None:
            VoiceProcessor._tts_engine = pyttsx3.init()
            # Configure engine
            VoiceProcessor._tts_engine.setProperty('rate', 150)  # Speed
            VoiceProcessor._tts_engine.setProperty('volume', 1.0)  # Volume
        return VoiceProcessor._tts_engine

    @staticmethod
    def transcribe_audio(audio_file_path, language="en-US"):
        """
        Transcribe audio file to text using Google Speech Recognition.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code (e.g., 'en-US', 'ro-RO')
        
        Returns:
            {
                'success': bool,
                'transcript': str,
                'confidence': float (0-1),
                'error': str or None
            }
        """
        try:
            recognizer = sr.Recognizer()
            
            
            with sr.AudioFile(audio_file_path) as source:
                audio = recognizer.record(source)
            
            
            try:
                transcript = recognizer.recognize_google(
                    audio,
                    language=language
                )
                return {
                    'success': True,
                    'transcript': transcript,
                    'confidence': 0.95,  
                    'detected_language': language,
                    'error': None
                }
            except sr.UnknownValueError:
                return {
                    'success': False,
                    'transcript': '',
                    'confidence': 0,
                    'error': 'Could not understand audio',
                    'detected_language': language
                }
            except sr.RequestError as e:
                return {
                    'success': False,
                    'transcript': '',
                    'confidence': 0,
                    'error': f'API Error: {str(e)}',
                    'detected_language': language
                }
                
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return {
                'success': False,
                'transcript': '',
                'confidence': 0,
                'error': f'Transcription error: {str(e)}',
                'detected_language': language
            }

    @staticmethod
    def text_to_speech(text, output_path=None):
        """
        Convert text to speech and optionally save to file.
        
        Args:
            text: Text to convert to speech
            output_path: Optional file path to save audio
        
        Returns:
            {
                'success': bool,
                'file_path': str or None,
                'error': str or None
            }
        """
        try:
            engine = VoiceProcessor.get_tts_engine()
            
            
            voices = engine.getProperty('voices')
            if voices:
                engine.setProperty('voice', voices[0].id)
            
            
            if output_path is None:
                output_path = tempfile.NamedTemporaryFile(
                    suffix='.mp3',
                    delete=False
                ).name
            
            engine.save_to_file(text, output_path)
            engine.runAndWait()
            
           
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return {
                    'success': True,
                    'file_path': output_path,
                    'error': None
                }
            else:
                return {
                    'success': False,
                    'file_path': None,
                    'error': 'Failed to generate speech'
                }
                
        except Exception as e:
            print(f"Error generating speech: {e}")
            return {
                'success': False,
                'file_path': None,
                'error': f'TTS error: {str(e)}'
            }

