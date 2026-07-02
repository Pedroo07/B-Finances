export enum ConversationAction {
  EDIT_TRANSACTION = "EDIT_TRANSACTION",
  EDIT_CARD_TRANSACTION = "EDIT_CARD_TRANSACTION",
  ADD_TRANSACTION_GUIDED = "ADD_TRANSACTION_GUIDED",
  ADD_BILL_GUIDED = "ADD_BILL_GUIDED",
  GENERIC_CONFIRM = "GENERIC_CONFIRM",
}

export enum ConversationField {
  TRANSACTION_DESCRIPTION = "transactionDescription", 
  FIELD_TO_EDIT = "fieldToEdit",                     
  NEW_VALUE = "newValue",                            

  DESCRIPTION = "description",
  AMOUNT = "amount",
  DATE = "date",
  CATEGORY = "category",
  PAYMENT_METHOD = "paymentMethod",

  BILL_DESCRIPTION = "billDescription",
  BILL_AMOUNT = "billAmount",
  BILL_DUE_DATE = "billDueDate",

  CONFIRMATION = "confirmation",
}


export type ConversationState = {

  action: ConversationAction;

  collectedData: Record<string, any>;

  nextQuestion: string | null;

  awaitingField: ConversationField | null;

  expiresAt: number;

  createdAt: number;

  metadata?: Record<string, any>;
};

export type ConversationStep = {

  field: ConversationField;

  question: string;
};

export const CONVERSATION_FLOWS: Record<ConversationAction, ConversationStep[]> =
  {
    [ConversationAction.EDIT_TRANSACTION]: [
      {
        field: ConversationField.TRANSACTION_DESCRIPTION,
        question: "🔍 Qual gasto você quer editar? Me diga a descrição.",
      },
      {
        field: ConversationField.FIELD_TO_EDIT,
        question:
          "✏️ O que você deseja alterar?\n\n1 - Descrição\n2 - Valor\n3 - Data",
      },
      {
        field: ConversationField.NEW_VALUE,
        question: "💬 Qual é o novo valor?",
      },
    ],

    [ConversationAction.EDIT_CARD_TRANSACTION]: [
      {
        field: ConversationField.TRANSACTION_DESCRIPTION,
        question: "🔍 Qual gasto do cartão você quer editar?",
      },
      {
        field: ConversationField.FIELD_TO_EDIT,
        question:
          "✏️ O que você deseja alterar?\n\n1 - Descrição\n2 - Valor\n3 - Data",
      },
      {
        field: ConversationField.NEW_VALUE,
        question: "💬 Qual é o novo valor?",
      },
    ],

    [ConversationAction.ADD_TRANSACTION_GUIDED]: [
      {
        field: ConversationField.DESCRIPTION,
        question: "📝 Qual a descrição do gasto?",
      },
      {
        field: ConversationField.AMOUNT,
        question: "💰 Qual o valor?",
      },
      {
        field: ConversationField.DATE,
        question: "📅 Qual a data? (ex: hoje, ontem, ou dd/mm/aaaa)",
      },
      {
        field: ConversationField.CATEGORY,
        question:
          "🏷️ Qual a categoria?\n\n1 - Alimentação\n2 - Fixas\n3 - Lazer\n4 - Outros",
      },
      {
        field: ConversationField.PAYMENT_METHOD,
        question:
          "💳 Qual o método de pagamento?\n\n1 - Dinheiro\n2 - Pix\n3 - Débito\n4 - Crédito",
      },
    ],

    [ConversationAction.ADD_BILL_GUIDED]: [
      {
        field: ConversationField.BILL_DESCRIPTION,
        question: "📝 Qual é o nome da conta a pagar?",
      },
      {
        field: ConversationField.BILL_AMOUNT,
        question: "💰 Qual o valor da conta?",
      },
      {
        field: ConversationField.BILL_DUE_DATE,
        question: "📅 Qual a data de vencimento? (ex: 10/07/2026 ou dd/mm/aaaa)",
      },
    ],

    [ConversationAction.GENERIC_CONFIRM]: [
      {
        field: ConversationField.CONFIRMATION,
        question: "✅ Confirma a ação? Responda *sim* ou *não*.",
      },
    ],
  };

export const CONVERSATION_STATE_TTL_MS = 10 * 60 * 1000;

export const CANCEL_MESSAGE =
  "❌ Ação cancelada. Como posso te ajudar?";

export const CANCEL_KEYWORDS = [
  "cancelar",
  "cancela",
  "cancel",
  "sair",
  "exit",
  "parar",
  "para",
  "não",
  "nao",
  "n",
];