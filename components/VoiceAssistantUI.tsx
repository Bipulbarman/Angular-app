
import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Import Modality to be used in the live session config.
import { GoogleGenAI, FunctionDeclaration, Type, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { AssistantStatus, TranscriptionEntry } from '../types';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { encode, decode, decodeAudioData, createBlob } from '../utils/audioUtils';

interface VoiceAssistantUIProps {
    onAddTodo: (task: string) => void;
    onAddNote: (content: string) => void;
    onSetReminder: (task: string, dateTime: string) => void;
    onExportData: () => void;
}

const functionDeclarations: FunctionDeclaration[] = [
    {
        name: 'addTodo',
        description: 'Adds a new task to the to-do list.',
        parameters: { type: Type.OBJECT, properties: { task: { type: Type.STRING, description: 'The task to add to the to-do list.' } }, required: ['task'] },
    },
    {
        name: 'addNote',
        description: 'Adds a new note.',
        parameters: { type: Type.OBJECT, properties: { content: { type: Type.STRING, description: 'The content of the note to add.' } }, required: ['content'] },
    },
    {
        name: 'setReminder',
        description: 'Sets a reminder for a specific task at a given date and time.',
        parameters: { type: Type.OBJECT, properties: { task: { type: Type.STRING, description: 'The reminder task.' }, dateTime: { type: Type.STRING, description: 'The date and time for the reminder in ISO 8601 format.' } }, required: ['task', 'dateTime'] },
    },
    {
        name: 'exportData',
        description: 'Exports all user data (todos, notes, reminders) to a JSON file.',
        parameters: { type: Type.OBJECT, properties: {} },
    }
];

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const VoiceAssistantUI: React.FC<VoiceAssistantUIProps> = ({ onAddTodo, onAddNote, onSetReminder, onExportData }) => {
    const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.Idle);
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const onMessageHandler = useCallback(async (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
            const { text, isFinal } = message.serverContent.inputTranscription;
            setTranscription(prev => {
                const last = prev[prev.length - 1];
                if (last?.source === 'user' && !last.isFinal) {
                    return [...prev.slice(0, -1), { source: 'user', text, isFinal }];
                }
                return [...prev, { source: 'user', text, isFinal }];
            });
        }
        
        if (message.serverContent?.outputTranscription) {
            const { text, isFinal } = message.serverContent.outputTranscription;
             setTranscription(prev => {
                const last = prev[prev.length - 1];
                if (last?.source === 'model' && !last.isFinal) {
                     const newText = last.text + text;
                     return [...prev.slice(0, -1), { source: 'model', text: newText, isFinal }];
                }
                return [...prev, { source: 'model', text, isFinal }];
            });
        }
        
        if(message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                let result = "ok";
                try {
                    if (fc.name === 'addTodo' && fc.args.task) {
                        onAddTodo(fc.args.task as string);
                    } else if (fc.name === 'addNote' && fc.args.content) {
                        onAddNote(fc.args.content as string);
                    } else if (fc.name === 'setReminder' && fc.args.task && fc.args.dateTime) {
                        onSetReminder(fc.args.task as string, fc.args.dateTime as string);
                    } else if (fc.name === 'exportData') {
                        onExportData();
                    } else {
                       result = "Function not found or arguments missing.";
                    }
                } catch (e) {
                   result = `Error executing function: ${e instanceof Error ? e.message : String(e)}`;
                }
                 if(sessionPromiseRef.current) {
                    sessionPromiseRef.current.then(session => {
                        session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } });
                    });
                 }
            }
        }

    }, [onAddTodo, onAddNote, onSetReminder, onExportData]);


    const connect = useCallback(async () => {
        setStatus(AssistantStatus.Listening);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Your browser does not support microphone access.");
            setStatus(AssistantStatus.Idle);
            return;
        }

        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // FIX: Cast window to any to access webkitAudioContext for broader browser support without TypeScript errors.
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                }
            };
            
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => console.log('Session opened'),
                    onmessage: onMessageHandler,
                    onerror: (e) => {
                        console.error('Session error:', e);
                        setStatus(AssistantStatus.Idle);
                    },
                    onclose: () => console.log('Session closed'),
                },
                config: {
                    // FIX: Per Gemini API guidelines, responseModalities must contain Modality.AUDIO for Live API.
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations }],
                    systemInstruction: `You are a helpful voice assistant named Jarvis. Your primary language is Hinglish (a mix of Hindi and English). Keep responses concise and friendly. When asked to set a reminder, resolve the user's request for a time (e.g., "in 5 minutes", "tomorrow at 8pm") into a precise ISO 8601 UTC date-time string and use the setReminder tool. You can also export all user data to a JSON file using the exportData tool.`,
                },
            });

        } catch (error) {
            console.error("Failed to start assistant:", error);
            alert("Could not access microphone. Please check permissions.");
            setStatus(AssistantStatus.Idle);
        }
    }, [onMessageHandler]);

    const disconnect = useCallback(() => {
        setStatus(AssistantStatus.Idle);
        
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if(mediaStreamSourceRef.current){
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
    }, []);

    const handleToggleAssistant = () => {
        if (status === AssistantStatus.Idle) {
            setTranscription([]);
            connect();
        } else {
            disconnect();
        }
    };
    
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 flex flex-col h-[70vh] max-h-[700px]">
             <h2 className="text-2xl font-semibold mb-4 text-white">Assistant</h2>
            <div className="flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto mb-4 min-h-0">
                {transcription.length === 0 && <div className="text-gray-500 text-center pt-8">Press the mic and start talking...</div>}
                <div className="space-y-4">
                {transcription.map((entry, index) => (
                    <div key={index} className={`flex ${entry.source === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <p className={`max-w-[80%] p-3 rounded-xl ${entry.source === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-600 text-white rounded-bl-none'}`}>
                            {entry.text}
                        </p>
                    </div>
                ))}
                </div>
            </div>
            <div className="flex flex-col items-center">
                <button
                    onClick={handleToggleAssistant}
                    className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg
                        ${status === AssistantStatus.Listening ? 'bg-red-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    <MicrophoneIcon />
                    {status === AssistantStatus.Listening && 
                     <div className="absolute inset-0 rounded-full bg-red-500 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                    }
                </button>
                 <p className="mt-4 text-sm text-gray-400 capitalize">{status}</p>
            </div>
        </div>
    );
};
