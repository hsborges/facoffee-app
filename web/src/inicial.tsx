import logo from '../../infra/keycloak/themes/facoffee/login/resources/img/facoffee-logo.svg';
import { ITENS_DO_TIPO_DE_COTA, NOME_DO_TIPO_DE_COTA } from './formato';

const PASSOS = [
  {
    titulo: 'Escolha o tipo de cota',
    texto: 'Só café ou completa. Se mudar de ideia, a troca vale a partir do mês seguinte.',
  },
  {
    titulo: 'Pague a cota do mês',
    texto:
      'No início de cada mês, a cota fica devida. Pague ao gestor por PIX ou em dinheiro; o que passar vira crédito para os próximos meses.',
  },
  {
    titulo: 'Acompanhe sua situação',
    texto: 'Veja se está em dia, pendente ou com crédito, sem precisar perguntar a ninguém.',
  },
  {
    titulo: 'A caixinha é de todos',
    texto:
      'Tudo o que é pago entra na caixinha e todo gasto sai dela. Se ela não der conta, o complemento é dividido igualmente entre os participantes ativos.',
  },
] as const;

const PERFIS = [
  {
    titulo: 'Para o participante',
    itens: [
      'Entrar, trocar de tipo de cota e sair.',
      'Ver o saldo da caixinha e o total gasto no ano anterior.',
      'Registrar um gasto com a nota e, se pagou do próprio bolso, receber o reembolso.',
      'Receber avisos por e-mail: valor da cota, pagamento recebido, complemento e reembolso.',
    ],
  },
  {
    titulo: 'Para o gestor',
    itens: [
      'Ver todos os participantes, com crédito e pendências.',
      'Receber pagamentos por PIX, com comprovante, ou em dinheiro.',
      'Reembolsar gastos, solicitar complemento e definir o valor da cota.',
      'Desativar e reativar o acesso de um participante.',
    ],
  },
] as const;

const PRINCIPIOS = [
  { titulo: 'Voluntário', texto: 'Sem multa, sem juros e sem bloqueio.' },
  { titulo: 'Ninguém é exposto', texto: 'Cada participante vê só a própria situação.' },
  { titulo: 'Só o gestor registra pagamento', texto: 'Inclusive o dinheiro entregue em mãos.' },
  { titulo: 'Consumo na confiança', texto: 'Nada é medido nem controlado.' },
] as const;

/** Start page for whoever is not logged in: what the FACOFFEE is and the button to sign in. */
export const PaginaInicial = ({ entrar }: { entrar: () => void }) => (
  <div className="inicial">
    <header className="inicial-topo">
      <img src={logo} alt="FACOFFEE" />
    </header>
    <main>
      <section className="heroi" aria-labelledby="heroi-titulo">
        <div>
          <p className="pilula">Copa da FACOM · UFMS</p>
          <h1 id="heroi-titulo">A copa organizada, sem ninguém precisar cobrar.</h1>
          <p className="destaque">
            Professores e técnicos administrativos da FACOM dividem o custo do café e dos demais
            itens da copa. O FACOFFEE organiza quem participa, quem pagou e quanto tem na caixinha.
          </p>
          <button type="button" className="grande" onClick={entrar}>
            Entrar
          </button>
          <p className="nota">Acesso pelo Passaporte UFMS.</p>
        </div>
        <div className="cartao">
          <h2>Tipos de cota</h2>
          <dl>
            {(['so-cafe', 'completa'] as const).map((tipo) => (
              <div key={tipo}>
                <dt>{NOME_DO_TIPO_DE_COTA[tipo]}</dt>
                <dd>{ITENS_DO_TIPO_DE_COTA[tipo]}</dd>
              </div>
            ))}
          </dl>
          <p>
            O gestor define o valor de cada tipo no início do ano, com base nos gastos do ano
            anterior.
          </p>
        </div>
      </section>

      <section aria-labelledby="passos-titulo">
        <h2 id="passos-titulo">Como funciona</h2>
        <ol className="passos">
          {PASSOS.map(({ titulo, texto }) => (
            <li key={titulo}>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="perfis-titulo">
        <h2 id="perfis-titulo">O que dá para fazer</h2>
        <div className="perfis">
          {PERFIS.map(({ titulo, itens }) => (
            <div key={titulo} className="cartao">
              <h3>{titulo}</h3>
              <ul>
                {itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="principios" aria-labelledby="principios-titulo">
        <h2 id="principios-titulo">Continua um combinado entre colegas</h2>
        <ul>
          {PRINCIPIOS.map(({ titulo, texto }) => (
            <li key={titulo}>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
    <footer className="inicial-rodape">
      <p>FACOFFEE · Divisão dos custos da copa da FACOM (UFMS).</p>
      <p>
        Projeto educativo da disciplina Técnicas Avançadas de Desenvolvimento de Software (2026/2).
      </p>
    </footer>
  </div>
);
