// local imports work fine, just make sure to use the `.ts` extension
import { uppercaseViaAPI } from './api.ts';

// dependency imports work as long as you've generated an import map
import chalk from 'chalk';
console.log(chalk.green(`Hello from a dependency!`));

addEventListener('DOMContentLoaded', (e: Event) => {
  (document.querySelector('#form') as HTMLElement).style.display = '';

  const handleSubmit = async () => {
    const input = (document.querySelector('#input') as HTMLInputElement).value;
    const { output } = await uppercaseViaAPI({ input });
    (document.querySelector('#output') as HTMLSpanElement).textContent = output;
  };

  (document.querySelector('#submit') as HTMLInputElement).addEventListener('click', handleSubmit);
  (document.querySelector('#input') as HTMLInputElement).addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });
});
