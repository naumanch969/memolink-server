import { entryClassifier } from './enrichment.classifier';

describe('EntryClassifier', () => {
    it('should classify trivial entries as noise', () => {
        const noiseEntries = [
            'woke up at 8am',
            'watched netflix',
            'had lunch',
            'at 3pm',
            'going to sleep now'
        ];

        noiseEntries.forEach(content => {
            const result = entryClassifier.classify(content, false, false);
            expect(result.tier).toBe('noise');
        });
    });

    it('should classify factual activity as log', () => {
        const logEntries = [
            'finished the figma mockup today and it looks great',
            'meeting with ahmed about the new project roadmap',
            'went for a 5k run in the park'
        ];

        logEntries.forEach(content => {
            const result = entryClassifier.classify(content, false, false);
            expect(result.tier).toBe('log');
        });
    });

    it('should classify reflective entries as signal', () => {
        const signalEntries = [
            'i feel like i am not making enough progress on my goals',
            'i realize that i have been avoiding this conversation for too long',
            'why do i keep doing this to myself?'
        ];

        signalEntries.forEach(content => {
            const result = entryClassifier.classify(content, false, false);
            expect(result.tier).toBe('signal');
        });
    });

    it('should classify important or complex entries as deep_signal', () => {
        // Test isImportant override
        const important = entryClassifier.classify('short note', true, false);
        expect(important.tier).toBe('deep_signal');

        // Test long reflective content
        const longReflective = `
            i have been thinking a lot lately about my career path and where i want to be in five years.
            it hit me today that i am more interested in creative work than management, even though 
            i keep pushing myself towards leadership roles. i feel anxious whenever i think about 
            switching paths, but also excited by the possibility of doing what i truly love.
            maybe it is time to have a serious talk with myself about what really matters.
        `;
        const result = entryClassifier.classify(longReflective, false, false);
        expect(result.tier).toBe('deep_signal');
    });

    it('should handle voice notes with a bonus', () => {
        // "call with ali" is usually noise/log, but if it is a voice note it might get a boost
        const content = 'talking about the project';
        const textResult = entryClassifier.classify(content, false, false);
        const voiceResult = entryClassifier.classify(content, false, true);

        expect(voiceResult.score).toBeGreaterThan(textResult.score);
    });
});
