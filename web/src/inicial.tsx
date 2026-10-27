import { ITENS_DO_TIPO_DE_COTA, NOME_DO_TIPO_DE_COTA } from './formato';
import { Icone, Marca } from './icones';

const PASSOS = [
  {
    titulo: 'Entre na copa',
    texto: 'Escolha o tipo de cota. Você já deve a cota do mês em que entrou.',
  },
  {
    titulo: 'Todo mês, uma cota',
    texto:
      'No início do mês, a cota fica devida. Se esquecer, um lembrete leve chega por e-mail a partir do dia 10.',
  },
  {
    titulo: 'Pague do seu jeito',
    texto: 'Faça o PIX e envie o comprovante aqui, ou entregue o dinheiro ao gestor.',
  },
  {
    titulo: 'O gestor confere',
    texto: 'Pagou a mais? Vira crédito e abate os próximos meses sozinho.',
  },
] as const;

const PERFIS = [
  {
    titulo: 'Participante',
    itens: [
      'Vê se está em dia, com crédito ou pendente',
      'Envia o comprovante do PIX',
      'Acompanha a caixinha de cada mês',
      'Registra um gasto que pagou do próprio bolso',
    ],
  },
  {
    titulo: 'Gestor',
    itens: [
      'Confirma ou recusa os comprovantes',
      'Recebe pagamentos em dinheiro',
      'Registra gastos e reembolsa quem pagou',
      'Define o valor da cota no início do ano',
    ],
  },
] as const;

const PRINCIPIOS = [
  { titulo: 'Entre colegas', texto: 'Voluntário, sem multa, sem juros e sem bloqueio.' },
  {
    titulo: 'Ninguém é exposto',
    texto: 'Cada um vê só a própria situação. Quem está pendente, só o gestor sabe.',
  },
  {
    titulo: 'Caixinha à vista',
    texto: 'Quanto entrou, quanto saiu com cada coisa e quanto sobrou, para todos.',
  },
  { titulo: 'Confiança no consumo', texto: 'Ninguém mede quantos cafés você toma.' },
] as const;

/** Start page for whoever is not logged in: what the FACOFFEE is and the button to sign in. */
export const PaginaInicial = ({ entrar }: { entrar: () => void }) => (
  <div className="inicial">
    <header className="inicial-topo">
      <Marca />
      <button type="button" className="contorno" onClick={entrar}>
        Entrar
      </button>
    </header>
    <main>
      <section className="heroi" aria-labelledby="heroi-titulo">
        <div>
          <p className="sobretitulo">Copa dos servidores da FACOM · UFMS</p>
          <h1 id="heroi-titulo">O café de todos, sem ninguém precisar cobrar.</h1>
          <p className="destaque">
            Cada um vê se está em dia, envia o próprio comprovante e acompanha a caixinha. O gestor
            só confere.
          </p>
          <div className="acoes">
            <button
              type="button"
              className="secundario grande"
              data-testid="entrar"
              onClick={entrar}
            >
              Entrar com o Passaporte UFMS
              <Icone nome="direita" />
            </button>
            <a href="#como-funciona">Como funciona</a>
          </div>
        </div>
        {/* An illustration of the pages, with made-up valores: hidden from screen readers. */}
        <div className="exemplo" aria-hidden="true">
          <div className="cartao">
            <p className="titulo-com-valor">
              <small>Minha situação</small>
              <span className="selo" data-selo="em-dia">
                <Icone nome="check" />
                Em dia
              </span>
            </p>
            <p className="valor-medio">R$ 60,00</p>
            <small>de crédito: cobre novembro e dezembro</small>
          </div>
          <div className="cartao espuma">
            <small>Caixinha de outubro</small>
            <p className="valor-medio">R$ 646,50</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="tipos-titulo">
        <h2 id="tipos-titulo">Dois tipos de cota</h2>
        <p className="apoio">
          Você escolhe ao entrar e pode trocar quando quiser: a troca vale a partir do mês seguinte.
        </p>
        <div className="tipos">
          {(['so-cafe', 'completa'] as const).map((tipo) => (
            <div key={tipo} className={tipo === 'completa' ? 'cartao escuro' : 'cartao'}>
              <h3 className="linha-com-icone">
                <span className="icone-fundo">
                  <Icone nome="cafe" />
                </span>
                {NOME_DO_TIPO_DE_COTA[tipo]}
              </h3>
              <p>{ITENS_DO_TIPO_DE_COTA[tipo]}</p>
            </div>
          ))}
        </div>
        <p className="nota">
          O gestor define o valor de cada tipo no início do ano, com base nos gastos do ano
          anterior, que ficam à vista de todos.
        </p>
      </section>

      <section id="como-funciona" aria-labelledby="passos-titulo">
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
        <h2 id="perfis-titulo">Quem faz o quê</h2>
        <div className="tipos">
          {PERFIS.map(({ titulo, itens }) => (
            <div key={titulo} className={titulo === 'Gestor' ? 'cartao espuma' : 'cartao'}>
              <h3>{titulo}</h3>
              <ul className="com-check">
                {itens.map((item) => (
                  <li key={item}>
                    <Icone nome="check" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="principios-titulo">
        <h2 id="principios-titulo">O combinado continua o mesmo</h2>
        <ul className="principios">
          {PRINCIPIOS.map(({ titulo, texto }) => (
            <li key={titulo}>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="chamada-final" aria-labelledby="chamada-titulo">
        <div>
          <h2 id="chamada-titulo">Já é da FACOM?</h2>
          <p>Entre com o seu Passaporte UFMS e confira a sua situação.</p>
        </div>
        <button type="button" className="secundario" onClick={entrar}>
          Entrar
        </button>
      </section>
    </main>
    <footer className="inicial-rodape">
      <p>FACOFFEE · Copa da FACOM · UFMS</p>
      <p>
        Projeto educativo da disciplina Técnicas Avançadas de Desenvolvimento de Software (2026/2).
        Dúvidas? Fale com o gestor da copa.
      </p>
    </footer>
  </div>
);
