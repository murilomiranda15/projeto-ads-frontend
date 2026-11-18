import { Component, input, output, effect, OnInit, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { CategoriaService } from '../../../core/services/categoria.service';
import { Categoria } from '../../../models/categoria.model';
import { LancamentoService } from '../../../core/services/lancamento.service';
import { LancamentoRequest, LancamentoResponse } from '../../../models/lancamento.model';
 
@Component({
  selector: 'app-lancamento-form',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './lancamento-form.html'
})
export class LancamentoForm implements OnInit {
  usuarioId = input.required<number>();
  
  lancamento = input<LancamentoResponse | null>(null);

  cancelou = output<void>();
  salvou = output<void>();
  
  categorias = signal<Categoria[]>([]);
  erro = signal('');
  salvando = signal(false);
 
  formulario = new FormGroup({
    descricao: new FormControl('', {nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)]}),
    valor: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    dataLancamento: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    observacao: new FormControl(''),
    categoriaId: new FormControl<number | null>(null, [Validators.required])
  });
 
  constructor(private categoriasService: CategoriaService,
              private lancamentosService: LancamentoService) {
    
    effect(() => {
      const item = this.lancamento();
      if (item) {
        this.formulario.patchValue({
          descricao: item.descricao,
          valor: item.valor,
          dataLancamento: item.dataLancamento ? item.dataLancamento.split('T')[0] : '',
          observacao: item.observacao || '',
          categoriaId: item.categoriaId
        });
      } else {
        this.formulario.reset();
      }
    });
  }
 
  ngOnInit(): void {
    this.categoriasService.listar().subscribe({
      next: dados => this.categorias.set(dados),
      error: () => this.erro.set('Falha ao carregar categorias.')
    });
  }

  categoriasDisponiveis = computed(() => {
    const item = this.lancamento();
    return this.categorias().filter(c => c.ativa || (item && c.id === item.categoriaId));
  });

  cancelar(): void {
    this.formulario.reset();
    this.erro.set('');
    this.cancelou.emit();
  }
 
  salvar(): void {
    if (this.formulario.invalid || this.salvando()) { 
      this.formulario.markAllAsTouched(); 
      return; 
    }

    const v = this.formulario.getRawValue();
    const dados: LancamentoRequest = {
      descricao: v.descricao.trim(), 
      valor: v.valor!,
      dataLancamento: v.dataLancamento,
      observacao: v.observacao || null, 
      categoriaId: v.categoriaId!
    };

    this.salvando.set(true); 
    this.erro.set('');

    const itemAtual = this.lancamento();

    if (itemAtual) {
      this.lancamentosService.atualizar(this.usuarioId(), itemAtual.id, dados).subscribe({
        next: () => {
          this.salvando.set(false);
          this.formulario.reset();
          this.salvou.emit();
        },
        error: err => {
          this.salvando.set(false);
          if (err.status === 404) {
            this.erro.set('Lançamento não encontrado (404).');
          } else if (err.status === 400) {
            this.erro.set(err.error?.erro || 'Dados inválidos. Verifique os campos (400).');
          } else {
            this.erro.set(err.error?.erro || 'Não foi possível atualizar o lançamento.');
          }
        }
      });
    } else {
      this.lancamentosService.cadastrar(this.usuarioId(), dados).subscribe({
        next: () => {
          this.salvando.set(false);
          this.formulario.reset();
          this.salvou.emit();
        },
        error: err => {
          this.salvando.set(false);
          if (err.status === 400) {
            this.erro.set(err.error?.erro || 'Dados inválidos. Verifique os campos (400).');
          } else {
            this.erro.set(err.error?.erro || 'Não foi possível salvar.');
          }
        }
      });
    }
  }
}