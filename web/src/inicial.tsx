import { ITENS_DO_TIPO_DE_COTA, NOME_DO_TIPO_DE_COTA } from './formato';
import { Icone, Marca } from './icones';

const PASSOS = [
  {
    titulo: 'Os gastos viram cota',
    texto:
      'O gestor define o valor da cota do ano com base nos gastos do ano anterior, que ficam à vista de todos.',
  },
  {
    titulo: 'Cada um escolhe a sua parte',
    texto:
      'Ao entrar na copa, escolha o tipo de cota: só café ou completa. A cota fica devida todo mês.',
  },
  {
    titulo: 'Pague a sua parte',
    texto:
      'Faça o PIX e envie o comprovante, ou entregue o dinheiro ao gestor. Pagou a mais? Vira crédito para os próximos meses.',
  },
  {
    titulo: 'A caixinha à vista',
    texto:
      'Cada pagamento entra na caixinha e cada gasto sai dela. Todos veem quanto entrou, quanto saiu e quanto sobrou.',
  },
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
          <p className="sobretitulo">O app da copa da FACOM</p>
          <h1 id="heroi-titulo">Apoiando a divisão de custos entre os servidores da FACOM.</h1>
          <p className="destaque">
            O FACOFFEE registra as cotas, os pagamentos e os gastos da copa: cada um sabe qual é a
            sua parte, e todos veem para onde vai o dinheiro.
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
          <small className="selo-exemplo">Exemplo do que o participante vê</small>
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
