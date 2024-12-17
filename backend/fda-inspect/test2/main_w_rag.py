import asyncio
import base64
import io
import os
import sys
import traceback
import time
import signal

import cv2
import pyaudio
import PIL.Image

from google import genai
from dotenv import load_dotenv

if sys.version_info < (3, 11, 0):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

load_dotenv()
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

MODEL = "models/gemini-2.0-flash-exp"

client = genai.Client(
    http_options={'api_version': 'v1alpha'})

search_tool = {'google_search': {}}

CONFIG={
    "generation_config": {"response_modalities": ["AUDIO"]},
    "tools": [search_tool]}

pya = pyaudio.PyAudio()

class AudioLoop:
    def __init__(self):
        self.audio_in_queue = asyncio.Queue()
        self.audio_out_queue = asyncio.Queue()
        self.video_out_queue = asyncio.Queue()
        self.session = None
        self.send_text_task = None
        self.receive_audio_task = None
        self.play_audio_task = None
        self.model_speaking = asyncio.Event()
        self.last_model_speak_time = 0
        self.shutdown_event = asyncio.Event()
        self.welcome_message_sent = asyncio.Event()

    async def send_welcome_message(self):
        welcome_prompt = "Welcome the user who is an FDA inspector 'Hello Inspector! Please tell me the background of your inspection today'"
        print("Sending welcome message...")
        await self.session.send(welcome_prompt, end_of_turn=True)
        print("Welcome message sent, waiting for response...")
        self.welcome_message_sent.set()

    async def send_text(self):
        await self.welcome_message_sent.wait()
        while not self.shutdown_event.is_set():
            text = await asyncio.to_thread(input, "message > ")
            if text.lower() == "q":
                self.shutdown_event.set()
                break
            print(f"Sending text: {text}")
            await self.session.send(text or ".", end_of_turn=True)
            print("Text sent, waiting for response...")

    def _get_frame(self, cap):
        ret, frame = cap.read()
        if not ret:
            return None
        img = PIL.Image.fromarray(frame)
        img.thumbnail([1024, 1024])
        image_io = io.BytesIO()
        img.save(image_io, format="jpeg")
        image_io.seek(0)
        mime_type = "image/jpeg"
        image_bytes = image_io.read()
        return {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

    async def get_frames(self):
        cap = await asyncio.to_thread(cv2.VideoCapture, 0)
        try:
            while not self.shutdown_event.is_set():
                frame = await asyncio.to_thread(self._get_frame, cap)
                if frame is None:
                    break
                await asyncio.sleep(1.0)
                self.video_out_queue.put_nowait(frame)
        finally:
            cap.release()

    async def send_frames(self):
        while not self.shutdown_event.is_set():
            frame = await self.video_out_queue.get()
            await self.session.send(frame)
            print("Frame sent")

    async def listen_audio(self):
        pya = pyaudio.PyAudio()
        mic_info = pya.get_default_input_device_info()
        stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            input_device_index=mic_info["index"],
            frames_per_buffer=CHUNK_SIZE,
        )
        try:
            while not self.shutdown_event.is_set():
                try:
                    data = await asyncio.to_thread(stream.read, CHUNK_SIZE)
                    self.audio_out_queue.put_nowait(data)
                except OSError as e:
                    if e.errno == -9981:
                        print("Warning: Input buffer overflow. Skipping this chunk.")
                        await asyncio.sleep(0.1)
                    else:
                        raise
        finally:
            stream.stop_stream()
            stream.close()
            pya.terminate()

    async def send_audio(self):
        while not self.shutdown_event.is_set():
            if not self.model_speaking.is_set():
                chunk = await self.audio_out_queue.get()
                await self.session.send({"data": chunk, "mime_type": "audio/pcm"})
                print("Audio chunk sent")
            else:
                await asyncio.sleep(0.1)

    async def receive_audio(self):
        while not self.shutdown_event.is_set():
            async for response in self.session.receive():
                print("Received response from server")
                server_content = response.server_content
                if server_content is not None:
                    model_turn = server_content.model_turn
                    if model_turn is not None:
                        parts = model_turn.parts
                        self.model_speaking.set()
                        print("Model started speaking")
                        self.last_model_speak_time = time.time()
                        for part in parts:
                            if part.text is not None:
                                print(f"Received text: {part.text}")
                            elif part.inline_data is not None:
                                print("Received audio data")
                                self.audio_in_queue.put_nowait(part.inline_data.data)
                    server_content.model_turn = None
                    turn_complete = server_content.turn_complete
                    if turn_complete:
                        print("Turn complete")
                        while not self.audio_in_queue.empty():
                            self.audio_in_queue.get_nowait()
                        self.model_speaking.clear()
                        print("Model finished speaking, ready to receive user audio")
                        if not self.welcome_message_sent.is_set():
                            self.welcome_message_sent.set()
                        print("message > ", end="", flush=True)

    async def play_audio(self):
        pya = pyaudio.PyAudio()
        stream = await asyncio.to_thread(
            pya.open, format=FORMAT, channels=CHANNELS, rate=RECEIVE_SAMPLE_RATE, output=True
        )
        try:
            while not self.shutdown_event.is_set():
                bytestream = await self.audio_in_queue.get()
                await asyncio.to_thread(stream.write, bytestream)
                self.last_model_speak_time = time.time()
                print("Played audio chunk")
        finally:
            stream.stop_stream()
            stream.close()
            pya.terminate()

    def check_error(self, task):
        try:
            task.result()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Task {task.get_name()} encountered an error: {e}")
            traceback.print_exception(type(e), e, e.__traceback__)
            self.shutdown_event.set()

    def signal_handler(self):
        print("Received shutdown signal")
        self.shutdown_event.set()

    async def cleanup(self):
        pass

    async def run(self):
        loop = asyncio.get_running_loop()
        loop.add_signal_handler(signal.SIGINT, self.signal_handler)
        loop.add_signal_handler(signal.SIGTERM, self.signal_handler)

        try:
            async with (
                client.aio.live.connect(model=MODEL, config=CONFIG) as session,
                asyncio.TaskGroup() as tg,
            ):
                self.session = session
                print("Connected to server")
                
                await self.send_welcome_message()
                
                send_text_task = tg.create_task(self.send_text())
                tasks = [
                    tg.create_task(self.listen_audio()),
                    tg.create_task(self.send_audio()),
                    tg.create_task(self.get_frames()),
                    tg.create_task(self.send_frames()),
                    tg.create_task(self.receive_audio()),
                    tg.create_task(self.play_audio())
                ]
                for task in tasks:
                    task.add_done_callback(self.check_error)
                print("All tasks started")
                await self.shutdown_event.wait()
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            print("Cleaning up resources...")
            await self.cleanup()

if __name__ == "__main__":
    main = AudioLoop()
    asyncio.run(main.run())
