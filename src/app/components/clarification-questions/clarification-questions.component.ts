import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'boolean' | 'choice' | 'multiselect' | 'text';
  options?: string[];
  answer?: any;
}

@Component({
  selector: 'app-clarification-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clarification-questions.component.html',
  styleUrls: ['./clarification-questions.component.scss']
})
export class ClarificationQuestionsComponent {
  @Input() questions: string[] = [];
  @Output() answersSubmitted = new EventEmitter<Map<string, string>>();

  parsedQuestions: ClarificationQuestion[] = [];
  answers: Map<string, string> = new Map();
  multiAnswers: Map<string, Set<string>> = new Map();

  ngOnInit() {
    this.parseQuestions();
  }

  ngOnChanges() {
    this.parseQuestions();
  }

  private parseQuestions() {
    this.parsedQuestions = this.questions.map((q, index) => {
      const id = `q-${index}`;
      
      // Detect if question says 'select multiple' or 'choose multiple'
      const isMulti = q.toLowerCase().includes('select multiple') || q.toLowerCase().includes('choose multiple') || q.toLowerCase().includes('select all');
      
      // Detect question type from text
      if (q.toLowerCase().includes('multi-region') || q.toLowerCase().includes('required?')) {
        return {
          id,
          question: q.replace('?', ''),
          type: 'boolean',
          options: ['Yes', 'No']
        };
      } else if (q.toLowerCase().includes('cicd') || q.toLowerCase().includes('ci/cd')) {
        return {
          id,
          question: q.replace('?', ''),
          type: isMulti ? 'multiselect' : 'choice',
          options: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'AWS CodePipeline', 'Azure DevOps']
        };
      } else if (q.toLowerCase().includes('monitoring') || q.toLowerCase().includes('apm')) {
        return {
          id,
          question: q.replace('?', ''),
          type: isMulti ? 'multiselect' : 'choice',
          options: ['DataDog', 'New Relic', 'Dynatrace', 'CloudWatch', 'Prometheus + Grafana']
        };
      } else if (q.toLowerCase().includes('database')) {
        return {
          id,
          question: q.replace('?', ''),
          type: isMulti ? 'multiselect' : 'choice',
          options: ['PostgreSQL', 'MySQL', 'DynamoDB', 'Aurora', 'MongoDB', 'Redis']
        };
      } else if (q.toLowerCase().includes('rpo') || q.toLowerCase().includes('rto')) {
        return {
          id,
          question: q.replace('?', ''),
          type: 'choice',
          options: ['< 1 hour', '1-4 hours', '4-24 hours', '> 24 hours']
        };
      } else if (q.toLowerCase().includes('traffic') || q.toLowerCase().includes('scaling')) {
        return {
          id,
          question: q.replace('?', ''),
          type: 'choice',
          options: ['Low (< 1k req/s)', 'Medium (1k-10k req/s)', 'High (10k-100k req/s)', 'Very High (> 100k req/s)']
        };
      } else {
        return {
          id,
          question: q.replace('?', ''),
          type: 'text'
        };
      }
    });
  }

  selectAnswer(questionId: string, answer: string) {
    const question = this.parsedQuestions.find(q => q.id === questionId);
    if (question && question.type === 'multiselect') {
      this.toggleMultiAnswer(questionId, answer);
    } else {
      this.answers.set(questionId, answer);
    }
  }

  toggleMultiAnswer(questionId: string, option: string) {
    if (!this.multiAnswers.has(questionId)) {
      this.multiAnswers.set(questionId, new Set());
    }
    const selected = this.multiAnswers.get(questionId)!;
    if (selected.has(option)) {
      selected.delete(option);
    } else {
      selected.add(option);
    }
    // Also sync to answers map as comma-separated string
    this.answers.set(questionId, Array.from(selected).join(', '));
  }

  isSelected(questionId: string, option: string): boolean {
    const question = this.parsedQuestions.find(q => q.id === questionId);
    if (question && question.type === 'multiselect') {
      return this.multiAnswers.get(questionId)?.has(option) || false;
    }
    return this.answers.get(questionId) === option;
  }

  submitAnswers() {
    // Build natural language answer string
    const answerTexts: string[] = [];
    
    this.parsedQuestions.forEach(q => {
      const answer = this.answers.get(q.id);
      if (answer) {
        // Map back to natural language
        if (q.question.toLowerCase().includes('multi-region')) {
          answerTexts.push(answer === 'Yes' ? 'Yes, multi-region deployment needed' : 'No multi-region needed');
        } else if (q.question.toLowerCase().includes('cicd')) {
          answerTexts.push(`CI/CD: ${answer}`);
        } else if (q.question.toLowerCase().includes('monitoring')) {
          answerTexts.push(`Monitoring: ${answer}`);
        } else if (q.question.toLowerCase().includes('rpo') || q.question.toLowerCase().includes('rto')) {
          answerTexts.push(`DR target: ${answer}`);
        } else if (q.question.toLowerCase().includes('traffic') || q.question.toLowerCase().includes('scaling')) {
          answerTexts.push(`Traffic scaling: ${answer}`);
        } else {
          answerTexts.push(`${q.question}: ${answer}`);
        }
      }
    });

    // Emit as chat message
    const chatMessage = answerTexts.join('. ');
    this.answersSubmitted.emit(new Map([['message', chatMessage]]));
  }

  skipQuestions() {
    this.answersSubmitted.emit(new Map([['message', 'Skip clarification questions']]));
  }

  get hasAnswers(): boolean {
    return this.answers.size > 0;
  }
}
