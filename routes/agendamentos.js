const express = require("express");
const router = express.Router();

// Rota para LISTAR agendamentos
router.get("/", (req, res) => {
  res.send("Lista de agendamentos");
});

// Rota para CRIAR um agendamento
router.post("/", (req, res) => {
  res.send("Agendamento criado com sucesso!");
});

// Rota para CANCELAR um agendamento
router.delete("/:id", (req, res) => {
  res.send(`Agendamento ${req.params.id} deletado!`);
});

module.exports = router;
